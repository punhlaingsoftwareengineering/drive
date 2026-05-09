import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/require-api-session', () => {
	return {
		requireApiSession: vi.fn().mockResolvedValue({
			user: { id: 'u1', email: 'a@example.com', name: 'Alice' }
		})
	};
});

vi.mock('$lib/server/team-access', () => {
	return {
		isTeamMember: vi.fn()
	};
});

describe('GET /api/drive/files', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects an invalid storage provider (400)', async () => {
		const { GET } = await import('./+server');
		const url = new URL('http://localhost/api/drive/files?storageProvider=not-a-provider');
		const request = new Request(url);

		await expect(GET({ request, url } as never)).rejects.toMatchObject({ status: 400 });
	});

	it('rejects a non-uuid team id (400)', async () => {
		const { GET } = await import('./+server');
		const url = new URL('http://localhost/api/drive/files?storageProvider=local&teamId=nope');
		const request = new Request(url);

		await expect(GET({ request, url } as never)).rejects.toMatchObject({ status: 400 });
	});

	it('rejects when user is not a team member (403)', async () => {
		const teamAccess = await import('$lib/server/team-access');
		(teamAccess.isTeamMember as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);

		const { GET } = await import('./+server');
		const teamId = '9a3d5a6e-7f68-4f2a-9f7d-20e7a4c9e6d1';
		const url = new URL(
			`http://localhost/api/drive/files?storageProvider=local&teamId=${teamId}`
		);
		const request = new Request(url);

		await expect(GET({ request, url } as never)).rejects.toMatchObject({ status: 403 });
	});

	it('rejects an invalid folder id (400)', async () => {
		const { GET } = await import('./+server');
		const url = new URL(
			'http://localhost/api/drive/files?storageProvider=local&parentId=not-a-uuid'
		);
		const request = new Request(url);

		await expect(GET({ request, url } as never)).rejects.toMatchObject({ status: 400 });
	});
});

