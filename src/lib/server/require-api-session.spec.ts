import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/auth', () => {
	return {
		auth: {
			api: {
				getSession: vi.fn()
			}
		}
	};
});

vi.mock('$lib/server/developer-api-key', () => {
	return {
		tryResolveUserFromDeveloperApiKey: vi.fn()
	};
});

async function importSubject() {
	const mod = await import('./require-api-session');
	const authMod = await import('$lib/server/auth');
	const devKeyMod = await import('$lib/server/developer-api-key');
	return {
		requireApiSession: mod.requireApiSession,
		auth: authMod.auth as unknown as { api: { getSession: ReturnType<typeof vi.fn> } },
		tryResolveUserFromDeveloperApiKey: devKeyMod.tryResolveUserFromDeveloperApiKey as ReturnType<
			typeof vi.fn
		>
	};
}

describe('requireApiSession', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns cookie session user when present', async () => {
		const { requireApiSession, auth, tryResolveUserFromDeveloperApiKey } = await importSubject();
		auth.api.getSession.mockResolvedValue({
			user: { id: 'u1', email: 'a@example.com', name: 'Alice' }
		});
		tryResolveUserFromDeveloperApiKey.mockResolvedValue(null);

		const req = new Request('http://localhost/api/drive/files', { headers: { cookie: 'x=y' } });
		await expect(requireApiSession(req)).resolves.toEqual({
			user: { id: 'u1', email: 'a@example.com', name: 'Alice' }
		});
		expect(auth.api.getSession).toHaveBeenCalledTimes(1);
		expect(tryResolveUserFromDeveloperApiKey).not.toHaveBeenCalled();
	});

	it('falls back to developer API key when cookie session missing', async () => {
		const { requireApiSession, auth, tryResolveUserFromDeveloperApiKey } = await importSubject();
		auth.api.getSession.mockResolvedValue(null);
		tryResolveUserFromDeveloperApiKey.mockResolvedValue({
			id: 'u2',
			email: 'dev@example.com',
			name: 'Dev'
		});

		const req = new Request('http://localhost/api/drive/files', {
			headers: { authorization: 'Bearer znldv_123456789012_secret' }
		});
		await expect(requireApiSession(req)).resolves.toEqual({
			user: { id: 'u2', email: 'dev@example.com', name: 'Dev' }
		});
		expect(auth.api.getSession).toHaveBeenCalledTimes(1);
		expect(tryResolveUserFromDeveloperApiKey).toHaveBeenCalledTimes(1);
	});

	it('throws 401 when neither cookie session nor API key is valid', async () => {
		const { requireApiSession, auth, tryResolveUserFromDeveloperApiKey } = await importSubject();
		auth.api.getSession.mockResolvedValue(null);
		tryResolveUserFromDeveloperApiKey.mockResolvedValue(null);

		const req = new Request('http://localhost/api/drive/files');
		await expect(requireApiSession(req)).rejects.toMatchObject({ status: 401 });
		expect(auth.api.getSession).toHaveBeenCalledTimes(1);
		expect(tryResolveUserFromDeveloperApiKey).toHaveBeenCalledTimes(1);
	});

	it('throws 503 when auth lookup throws a non-HTTP error', async () => {
		const { requireApiSession, auth } = await importSubject();
		auth.api.getSession.mockRejectedValue(new Error('db down'));

		const req = new Request('http://localhost/api/drive/files');
		await expect(requireApiSession(req)).rejects.toMatchObject({ status: 503 });
		expect(auth.api.getSession).toHaveBeenCalledTimes(1);
	});
});
