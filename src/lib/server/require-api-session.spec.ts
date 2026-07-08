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
			user: { id: 'u1', email: 'a@example.com', name: 'Alice' },
			viaApiKey: false
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
			name: 'Dev',
			apiKeyId: 'key-1',
			kind: 'user',
			teamId: null,
			permissions: [],
			limits: { maxTeams: null, maxFolders: null, maxFiles: null }
		});

		const req = new Request('http://localhost/api/drive/files', {
			headers: { authorization: 'Bearer znldv_123456789012_secret' }
		});
		await expect(requireApiSession(req)).resolves.toEqual({
			user: { id: 'u2', email: 'dev@example.com', name: 'Dev' },
			viaApiKey: true,
			apiKeyId: 'key-1',
			apiKeyLimits: { maxTeams: null, maxFolders: null, maxFiles: null },
			apiKeyTeamId: null,
			apiKeyPermissions: []
		});
		expect(auth.api.getSession).toHaveBeenCalledTimes(1);
		expect(tryResolveUserFromDeveloperApiKey).toHaveBeenCalledTimes(1);
	});

	it('returns team key session shape when API key is team-scoped', async () => {
		const { requireApiSession, auth, tryResolveUserFromDeveloperApiKey } = await importSubject();
		auth.api.getSession.mockResolvedValue(null);
		const teamId = '9a3d5a6e-7f68-4f2a-9f7d-20e7a4c9e6d1';
		tryResolveUserFromDeveloperApiKey.mockResolvedValue({
			id: 'u2',
			email: 'dev@example.com',
			name: 'Dev',
			apiKeyId: 'key-team-1',
			kind: 'team',
			teamId,
			permissions: ['drive.read', 'drive.write'],
			limits: { maxTeams: null, maxFolders: 50, maxFiles: 5000 }
		});

		const req = new Request('http://localhost/api/drive/files', {
			headers: { Authorization: 'Bearer znltv_AbCdEfGhIjKl_secret' }
		});
		await expect(requireApiSession(req)).resolves.toEqual({
			user: { id: 'u2', email: 'dev@example.com', name: 'Dev' },
			viaApiKey: true,
			apiKeyId: 'key-team-1',
			apiKeyLimits: { maxTeams: null, maxFolders: 50, maxFiles: 5000 },
			apiKeyTeamId: teamId,
			apiKeyPermissions: ['drive.read', 'drive.write']
		});
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
