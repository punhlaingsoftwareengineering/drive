import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('$app/paths', () => {
	return {
		resolve: (p: string) => p
	};
});

vi.mock('$lib/remote/auth-remote/login.remote', () => {
	return {
		logInWithEmailAndPassword: vi.fn()
	};
});

describe('POST /api/auth/login', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns JSON {success:true} when Accept: application/json', async () => {
		const remote = await import('$lib/remote/auth-remote/login.remote');
		(remote.logInWithEmailAndPassword as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

		const { POST } = await import('./+server');
		const request = new Request('http://localhost/api/auth/login', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				accept: 'application/json'
			},
			body: JSON.stringify({ email: 'a@example.com', password: 'correct-horse' })
		});

		const res = await POST({ request } as never);
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toContain('application/json');
		await expect(res.json()).resolves.toEqual({ success: true });
	});

	it('rejects invalid body (400)', async () => {
		const { POST } = await import('./+server');
		const request = new Request('http://localhost/api/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			body: '{ not json'
		});

		await expect(POST({ request } as never)).rejects.toMatchObject({ status: 400 });
	});

	it('rejects invalid credentials from remote (401)', async () => {
		const remote = await import('$lib/remote/auth-remote/login.remote');
		(remote.logInWithEmailAndPassword as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error('bad credentials')
		);

		const { POST } = await import('./+server');
		const fd = new FormData();
		fd.set('email', 'a@example.com');
		fd.set('password', 'wrong-pass'); // >= 8 chars, passes zod shape
		const request = new Request('http://localhost/api/auth/login', {
			method: 'POST',
			headers: { accept: 'application/json' },
			body: fd
		});

		await expect(POST({ request } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('redirects (303) for non-JSON accept header', async () => {
		const remote = await import('$lib/remote/auth-remote/login.remote');
		(remote.logInWithEmailAndPassword as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

		const { POST } = await import('./+server');
		const request = new Request('http://localhost/api/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'text/html' },
			body: JSON.stringify({ email: 'a@example.com', password: 'long-enough' })
		});

		await expect(POST({ request } as never)).rejects.toMatchObject({ status: 303 });
	});
});

