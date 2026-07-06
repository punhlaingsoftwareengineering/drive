import { db } from '$lib/server/db';
import type { StorageProviderId } from '$lib/model/storage-provider';
import { sql } from 'drizzle-orm';

/**
 * Sum of `size_bytes` for all descendant **files** (recursive) under `folderId`.
 * Same owner, storage provider, not trashed.
 */
export async function sumSubtreeFileBytesForFolder(
	folderId: string,
	ownerId: string,
	storageProvider: StorageProviderId
): Promise<number> {
	const result = (await db.execute(sql`
		WITH RECURSIVE sub AS (
			SELECT id
			FROM main_file
			WHERE id = ${folderId}::uuid
				AND owner_id = ${ownerId}
				AND storage_provider = ${storageProvider}
				AND trashed_at IS NULL
			UNION ALL
			SELECT m.id
			FROM main_file m
			INNER JOIN sub s ON m.parent_id = s.id
			WHERE m.owner_id = ${ownerId}
				AND m.storage_provider = ${storageProvider}
				AND m.trashed_at IS NULL
		)
		SELECT COALESCE(SUM(m.size_bytes), 0)::bigint AS total
		FROM main_file m
		WHERE m.item_type = 'file'
			AND m.id IN (SELECT id FROM sub)
	`)) as unknown as { rows: Array<{ total: string | bigint | number }> };
	const v = result.rows[0]?.total;
	if (v === undefined || v === null) return 0;
	return typeof v === 'bigint' ? Number(v) : Number(v);
}

/** Batch folder subtree sizes (parallel; one query per folder). */
export async function sumSubtreeFileBytesForFolders(
	folderIds: string[],
	ownerId: string,
	storageProvider: StorageProviderId
): Promise<Map<string, number>> {
	const map = new Map<string, number>();
	if (folderIds.length === 0) return map;
	const pairs = await Promise.all(
		folderIds.map(async (id) => {
			const n = await sumSubtreeFileBytesForFolder(id, ownerId, storageProvider);
			return [id, n] as const;
		})
	);
	for (const [id, n] of pairs) map.set(id, n);
	return map;
}

/** Team drive: subtree by `team_id` (not `owner_id`). */
export async function sumSubtreeFileBytesForFolderTeam(
	folderId: string,
	teamId: string,
	storageProvider: StorageProviderId
): Promise<number> {
	const result = (await db.execute(sql`
		WITH RECURSIVE sub AS (
			SELECT id
			FROM main_file
			WHERE id = ${folderId}::uuid
				AND team_id = ${teamId}::uuid
				AND storage_provider = ${storageProvider}
				AND trashed_at IS NULL
			UNION ALL
			SELECT m.id
			FROM main_file m
			INNER JOIN sub s ON m.parent_id = s.id
			WHERE m.team_id = ${teamId}::uuid
				AND m.storage_provider = ${storageProvider}
				AND m.trashed_at IS NULL
		)
		SELECT COALESCE(SUM(m.size_bytes), 0)::bigint AS total
		FROM main_file m
		WHERE m.item_type = 'file'
			AND m.id IN (SELECT id FROM sub)
	`)) as unknown as { rows: Array<{ total: string | bigint | number }> };
	const v = result.rows[0]?.total;
	if (v === undefined || v === null) return 0;
	return typeof v === 'bigint' ? Number(v) : Number(v);
}

export async function sumSubtreeFileBytesForFoldersTeam(
	folderIds: string[],
	teamId: string,
	storageProvider: StorageProviderId
): Promise<Map<string, number>> {
	const map = new Map<string, number>();
	if (folderIds.length === 0) return map;
	const pairs = await Promise.all(
		folderIds.map(async (id) => {
			const n = await sumSubtreeFileBytesForFolderTeam(id, teamId, storageProvider);
			return [id, n] as const;
		})
	);
	for (const [id, n] of pairs) map.set(id, n);
	return map;
}

/** Folders may belong to different owners (e.g. shared view). */
export async function sumSubtreeFileBytesForFolderRows(
	folders: { id: string; ownerId: string; storageProvider: StorageProviderId }[]
): Promise<Map<string, number>> {
	const map = new Map<string, number>();
	if (folders.length === 0) return map;
	const pairs = await Promise.all(
		folders.map(async (f) => {
			const n = await sumSubtreeFileBytesForFolder(f.id, f.ownerId, f.storageProvider);
			return [f.id, n] as const;
		})
	);
	for (const [id, n] of pairs) map.set(id, n);
	return map;
}

/**
 * Sum of `size_bytes` for all descendant **files** under `folderId` (any trash state).
 * Used for trashed folder rows where children may or may not have `trashed_at` set.
 */
export async function sumSubtreeFileBytesForFolderOwnerTree(
	folderId: string,
	ownerId: string,
	storageProvider: StorageProviderId
): Promise<number> {
	const result = (await db.execute(sql`
		WITH RECURSIVE sub AS (
			SELECT id
			FROM main_file
			WHERE id = ${folderId}::uuid
				AND owner_id = ${ownerId}
				AND storage_provider = ${storageProvider}
			UNION ALL
			SELECT m.id
			FROM main_file m
			INNER JOIN sub s ON m.parent_id = s.id
			WHERE m.owner_id = ${ownerId}
				AND m.storage_provider = ${storageProvider}
		)
		SELECT COALESCE(SUM(m.size_bytes), 0)::bigint AS total
		FROM main_file m
		WHERE m.item_type = 'file'
			AND m.id IN (SELECT id FROM sub)
	`)) as unknown as { rows: Array<{ total: string | bigint | number }> };
	const v = result.rows[0]?.total;
	if (v === undefined || v === null) return 0;
	return typeof v === 'bigint' ? Number(v) : Number(v);
}

/** Batch sizes for trashed folder rows. */
export async function sumSubtreeFileBytesForTrashedFolderRows(
	folders: { id: string; ownerId: string; storageProvider: StorageProviderId }[]
): Promise<Map<string, number>> {
	const map = new Map<string, number>();
	if (folders.length === 0) return map;
	const pairs = await Promise.all(
		folders.map(async (f) => {
			const n = await sumSubtreeFileBytesForFolderOwnerTree(f.id, f.ownerId, f.storageProvider);
			return [f.id, n] as const;
		})
	);
	for (const [id, n] of pairs) map.set(id, n);
	return map;
}

/** Trashed team folder subtree sizes (any trash state under folder). */
export async function sumSubtreeFileBytesForFolderTeamTree(
	folderId: string,
	teamId: string,
	storageProvider: StorageProviderId
): Promise<number> {
	const result = (await db.execute(sql`
		WITH RECURSIVE sub AS (
			SELECT id
			FROM main_file
			WHERE id = ${folderId}::uuid
				AND team_id = ${teamId}::uuid
				AND storage_provider = ${storageProvider}
			UNION ALL
			SELECT m.id
			FROM main_file m
			INNER JOIN sub s ON m.parent_id = s.id
			WHERE m.team_id = ${teamId}::uuid
				AND m.storage_provider = ${storageProvider}
		)
		SELECT COALESCE(SUM(m.size_bytes), 0)::bigint AS total
		FROM main_file m
		WHERE m.item_type = 'file'
			AND m.id IN (SELECT id FROM sub)
	`)) as unknown as { rows: Array<{ total: string | bigint | number }> };
	const v = result.rows[0]?.total;
	if (v === undefined || v === null) return 0;
	return typeof v === 'bigint' ? Number(v) : Number(v);
}

export async function sumSubtreeFileBytesForTrashedFolderRowsTeam(
	folders: { id: string; teamId: string; storageProvider: StorageProviderId }[]
): Promise<Map<string, number>> {
	const map = new Map<string, number>();
	if (folders.length === 0) return map;
	const pairs = await Promise.all(
		folders.map(async (f) => {
			const n = await sumSubtreeFileBytesForFolderTeamTree(f.id, f.teamId, f.storageProvider);
			return [f.id, n] as const;
		})
	);
	for (const [id, n] of pairs) map.set(id, n);
	return map;
}
