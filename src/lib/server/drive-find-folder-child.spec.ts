import { describe, expect, it, vi, beforeEach } from 'vitest';

const { dbChain, selectResults } = vi.hoisted(() => {
	const selectResults = { rows: [] as unknown[] };
	const dbChain = {
		select: vi.fn(() => dbChain),
		from: vi.fn(() => dbChain),
		where: vi.fn(() => dbChain),
		orderBy: vi.fn(() => dbChain),
		limit: vi.fn(async () => selectResults.rows)
	};
	return { dbChain, selectResults };
});

vi.mock('$lib/server/db', () => ({ db: dbChain }));

import { findExistingFolderChild } from './drive-find-folder-child';

describe('findExistingFolderChild', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		selectResults.rows = [];
	});

	it('matches user root folders by null parent', async () => {
		selectResults.rows = [{ id: 'folder-1', parentId: null }];

		const found = await findExistingFolderChild(
			{ kind: 'user', ownerId: 'user-1', storageProvider: 'local', parentId: null },
			'portal'
		);

		expect(found).toEqual({ id: 'folder-1', parentId: null });
	});

	it('prefers canonical team root child over orphan portal folder', async () => {
		selectResults.rows = [
			{ id: 'orphan-portal', parentId: null },
			{ id: 'canonical-portal', parentId: 'team-root' }
		];

		const found = await findExistingFolderChild(
			{
				kind: 'team',
				teamId: 'team-1',
				storageProvider: 'local',
				parentId: 'team-root',
				teamRootId: 'team-root'
			},
			'portal'
		);

		expect(found).toEqual({ id: 'canonical-portal', parentId: 'team-root' });
	});

	it('returns orphan portal folder when no canonical child exists', async () => {
		selectResults.rows = [{ id: 'orphan-portal', parentId: null }];

		const found = await findExistingFolderChild(
			{
				kind: 'team',
				teamId: 'team-1',
				storageProvider: 'local',
				parentId: 'team-root',
				teamRootId: 'team-root'
			},
			'portal'
		);

		expect(found).toEqual({ id: 'orphan-portal', parentId: null });
	});
});
