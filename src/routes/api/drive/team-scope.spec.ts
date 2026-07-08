import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/require-api-session', () => ({
	requireApiSession: vi.fn().mockResolvedValue({
		user: { id: 'u1', email: 'a@example.com', name: 'Alice' }
	})
}));

vi.mock('$lib/server/team-access', () => ({
	isTeamMember: vi.fn(),
	requireTeamMember: vi.fn()
}));

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn()
	}
}));

describe('team-scoped drive APIs', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('GET /api/drive/trash rejects invalid team id (400)', async () => {
		const { GET } = await import('./trash/+server');
		const url = new URL('http://localhost/api/drive/trash?storageProvider=local&teamId=not-uuid');
		const request = new Request(url);

		await expect(GET({ request, url } as never)).rejects.toMatchObject({ status: 400 });
	});

	it('GET /api/drive/trash rejects non-member (403)', async () => {
		const teamAccess = await import('$lib/server/team-access');
		(teamAccess.requireTeamMember as ReturnType<typeof vi.fn>).mockRejectedValue(
			Object.assign(new Error('Forbidden'), { status: 403 })
		);

		const { db } = await import('$lib/server/db');
		const teamId = '9a3d5a6e-7f68-4f2a-9f7d-20e7a4c9e6d1';
		const limit = vi.fn().mockResolvedValue([{ id: teamId, storageProvider: 'local' }]);
		const where = vi.fn().mockReturnValue({ limit });
		const from = vi.fn().mockReturnValue({ where });
		(db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from });

		const { GET } = await import('./trash/+server');
		const url = new URL(`http://localhost/api/drive/trash?storageProvider=local&teamId=${teamId}`);
		const request = new Request(url);

		await expect(GET({ request, url } as never)).rejects.toMatchObject({ status: 403 });
	});

	it('GET /api/drive/stats rejects invalid team id (400)', async () => {
		const { GET } = await import('./stats/+server');
		const url = new URL('http://localhost/api/drive/stats?storageProvider=local&teamId=bad');
		const request = new Request(url);

		await expect(GET({ request, url } as never)).rejects.toMatchObject({ status: 400 });
	});
});
