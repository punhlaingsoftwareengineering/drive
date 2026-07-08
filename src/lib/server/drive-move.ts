import type { StorageProviderId } from '$lib/model/storage-provider';
import { collectSubtreeRowsByRootId } from '$lib/server/drive-permanent-delete';
import { resolveParentFolderForTeam } from '$lib/server/drive-parent-team';
import { resolveParentFolderForUser } from '$lib/server/drive-parent';
import { nextSortOrderInParent } from '$lib/server/drive-sort-order';
import {
	localPathNewFileAtRoot,
	localPathNewFileInsideFolder,
	localPathNewFolderAtRoot,
	localPathNewSubfolder,
	tigrisKeyNewFileAtRoot,
	tigrisKeyNewFileAtRootTeam,
	tigrisKeyNewFileInsideFolder,
	tigrisKeyNewFileInsideFolderTeam,
	tigrisKeyNewFolderAtRoot,
	tigrisKeyNewFolderAtRootTeam,
	tigrisKeyNewSubfolder,
	tigrisKeyNewSubfolderTeam
} from '$lib/server/drive-storage-layout';
import { requireMainFileForMutation } from '$lib/server/drive-file-access';
import { db } from '$lib/server/db';
import { MainFileSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { TeamSchema } from '$lib/server/db/schema/main-schema/team.schema';
import { localTeamUploadDir, localUserUploadDir } from '$lib/server/local-drive-path';
import { TigrisUtil } from '$lib/service/tigris.service.svelte';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { rename } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';

type MainFileRow = typeof MainFileSchema.$inferSelect;

export type MoveFailure = { id: string; reason: string };

/** Returns true if moving `sourceFolderId` into `targetFolderId` would create a cycle. */
export function wouldCreateMoveCycle(
	sourceFolderId: string,
	targetFolderId: string | null,
	descendantIds: Set<string>
): boolean {
	if (!targetFolderId) return false;
	if (sourceFolderId === targetFolderId) return true;
	return descendantIds.has(targetFolderId);
}

/** Keep only items whose parent is not also being moved (avoids double-move of nested selections). */
export function filterTopLevelMoveIds(
	ids: string[],
	rowsById: Map<string, { parentId: string | null }>
): string[] {
	const idSet = new Set(ids);
	return ids.filter((id) => {
		const row = rowsById.get(id);
		if (!row) return false;
		return !row.parentId || !idSet.has(row.parentId);
	});
}

function replacePathPrefix(oldPrefix: string, newPrefix: string, path: string): string {
	if (path === oldPrefix) return newPrefix;
	const oldWithSep = oldPrefix.endsWith('/') ? oldPrefix : oldPrefix + sep;
	if (path.startsWith(oldWithSep)) {
		const suffix = path.slice(oldWithSep.length);
		return newPrefix.endsWith('/') ? newPrefix + suffix : join(newPrefix, suffix);
	}
	// Tigris-style paths
	const oldSlash = oldPrefix.endsWith('/') ? oldPrefix : `${oldPrefix}/`;
	if (path.startsWith(oldSlash)) {
		const suffix = path.slice(oldSlash.length);
		const newSlash = newPrefix.endsWith('/') ? newPrefix : `${newPrefix}/`;
		return newSlash + suffix;
	}
	return path;
}

function computeNewStoredPath(
	row: Pick<MainFileRow, 'id' | 'name' | 'itemType'>,
	parentFolder: { path: string } | null,
	userId: string,
	teamId: string | null,
	provider: StorageProviderId
): string {
	if (provider === 'local') {
		const baseDir = teamId ? localTeamUploadDir(teamId) : localUserUploadDir(userId);
		if (row.itemType === 'folder') {
			return parentFolder
				? localPathNewSubfolder(parentFolder.path, row.id)
				: localPathNewFolderAtRoot(baseDir, row.id);
		}
		return parentFolder
			? localPathNewFileInsideFolder(parentFolder.path, row.id, row.name)
			: localPathNewFileAtRoot(baseDir, row.id, row.name);
	}

	if (row.itemType === 'folder') {
		if (parentFolder) {
			return teamId
				? tigrisKeyNewSubfolderTeam(parentFolder.path, row.id)
				: tigrisKeyNewSubfolder(parentFolder.path, row.id);
		}
		return teamId
			? tigrisKeyNewFolderAtRootTeam(teamId, row.id)
			: tigrisKeyNewFolderAtRoot(userId, row.id);
	}

	if (parentFolder) {
		return teamId
			? tigrisKeyNewFileInsideFolderTeam(parentFolder.path, row.id, row.name)
			: tigrisKeyNewFileInsideFolder(parentFolder.path, row.id, row.name);
	}
	return teamId
		? tigrisKeyNewFileAtRootTeam(teamId, row.id, row.name)
		: tigrisKeyNewFileAtRoot(userId, row.id, row.name);
}

async function copyTigrisObject(fromPath: string, toPath: string): Promise<void> {
	const buf = await TigrisUtil.downloadFile(fromPath);
	const ab = await buf.arrayBuffer();
	await TigrisUtil.upload(toPath, Buffer.from(ab), {
		contentType: 'application/octet-stream',
		allowOverwrite: true
	});
}

async function moveStorageLocal(oldPath: string, newPath: string): Promise<void> {
	await mkdirParents(newPath);
	await rename(oldPath, newPath);
}

async function mkdirParents(fileOrFolderPath: string): Promise<void> {
	const { mkdir } = await import('node:fs/promises');
	await mkdir(dirname(fileOrFolderPath), { recursive: true });
}

async function moveSingleItemStorage(
	row: MainFileRow,
	newPath: string,
	subtree: { id: string; path: string; itemType: string; storageProvider: string }[]
): Promise<void> {
	if (row.storageProvider === 'local') {
		await moveStorageLocal(row.path, newPath);
		if (row.itemType === 'folder') {
			for (const sub of subtree) {
				if (sub.id === row.id) continue;
				// paths updated in DB only; disk tree moved with folder rename
			}
		}
		return;
	}

	if (row.itemType === 'folder') {
		for (const sub of subtree) {
			const subNewPath = replacePathPrefix(row.path, newPath, sub.path);
			if (sub.path !== subNewPath) {
				await copyTigrisObject(sub.path, subNewPath);
			}
		}
		for (const sub of subtree) {
			await TigrisUtil.deleteObject(sub.path);
		}
	} else {
		await copyTigrisObject(row.path, newPath);
		await TigrisUtil.deleteObject(row.path);
	}
}

async function resolveTargetParent(
	userId: string,
	teamId: string | null,
	provider: StorageProviderId,
	parentIdRaw: string | null
): Promise<{ id: string | null; path: string | null; folder: { id: string; path: string } | null }> {
	if (teamId && !parentIdRaw) {
		const [t] = await db
			.select({ root: TeamSchema.rootFolderId })
			.from(TeamSchema)
			.where(eq(TeamSchema.id, teamId))
			.limit(1);
		if (!t?.root) throw error(500, 'Team root not configured');
		const folder = await resolveParentFolderForTeam(userId, teamId, provider, t.root);
		return { id: t.root, path: folder?.path ?? null, folder };
	}

	if (!parentIdRaw) {
		return { id: null, path: null, folder: null };
	}

	const folder = teamId
		? await resolveParentFolderForTeam(userId, teamId, provider, parentIdRaw)
		: await resolveParentFolderForUser(userId, provider, parentIdRaw);

	if (!folder) throw error(400, 'Target folder not found');
	return { id: folder.id, path: folder.path, folder };
}

export async function moveDriveItemsForUser(opts: {
	userId: string;
	ids: string[];
	parentId: string | null;
	teamId: string | null;
	storageProvider: StorageProviderId;
}): Promise<{ ok: boolean; failed: MoveFailure[] }> {
	const { userId, ids, teamId, storageProvider } = opts;
	const failed: MoveFailure[] = [];

	const rows: MainFileRow[] = [];
	for (const id of ids) {
		try {
			const row = await requireMainFileForMutation(userId, id);
			if (row.trashedAt) {
				failed.push({ id, reason: 'Item is in trash' });
				continue;
			}
			if (row.storageProvider !== storageProvider) {
				failed.push({ id, reason: 'Storage provider mismatch' });
				continue;
			}
			if (teamId) {
				if (row.teamId !== teamId) {
					failed.push({ id, reason: 'Team scope mismatch' });
					continue;
				}
			} else if (row.teamId !== null || row.ownerId !== userId) {
				failed.push({ id, reason: 'Forbidden' });
				continue;
			}
			rows.push(row);
		} catch (e) {
			failed.push({ id, reason: e instanceof Error ? e.message : 'Not found' });
		}
	}

	if (rows.length === 0) {
		return { ok: false, failed };
	}

	const target = await resolveTargetParent(userId, teamId, storageProvider, opts.parentId);
	const targetFolder = target.folder;

	const rowsById = new Map(rows.map((r) => [r.id, r]));
	const topLevelIds = filterTopLevelMoveIds(
		rows.map((r) => r.id),
		new Map(rows.map((r) => [r.id, { parentId: r.parentId }]))
	);

	const movingIdSet = new Set(topLevelIds);

	if (target.id && movingIdSet.has(target.id)) {
		return { ok: false, failed: [...failed, { id: target.id, reason: 'Cannot move into itself' }] };
	}

	for (const id of topLevelIds) {
		const row = rowsById.get(id);
		if (!row) continue;

		const currentParent = row.parentId ?? null;
		if (currentParent === target.id) continue;

		if (row.itemType === 'folder') {
			const subtree = await collectSubtreeRowsByRootId(id);
			const descendantIds = new Set(subtree.map((s) => s.id));
			if (wouldCreateMoveCycle(id, target.id, descendantIds)) {
				failed.push({ id, reason: 'Cannot move folder into itself or a descendant' });
				continue;
			}
		}

		const newPath = computeNewStoredPath(
			row,
			targetFolder,
			userId,
			teamId,
			storageProvider
		);

		const sortOrder = await nextSortOrderInParent(
			target.id,
			teamId
				? { kind: 'team', teamId, storageProvider }
				: { kind: 'user', ownerId: userId, storageProvider }
		);

		try {
			const subtree =
				row.itemType === 'folder' ? await collectSubtreeRowsByRootId(id) : [{ id: row.id, path: row.path, itemType: row.itemType, storageProvider: row.storageProvider }];

			await moveSingleItemStorage(row, newPath, subtree);

			await db
				.update(MainFileSchema)
				.set({ parentId: target.id, path: newPath, sortOrder })
				.where(eq(MainFileSchema.id, id));

			if (row.itemType === 'folder') {
				for (const sub of subtree) {
					if (sub.id === id) continue;
					const subNewPath = replacePathPrefix(row.path, newPath, sub.path);
					await db
						.update(MainFileSchema)
						.set({ path: subNewPath })
						.where(eq(MainFileSchema.id, sub.id));
				}
			}
		} catch (e) {
			failed.push({ id, reason: e instanceof Error ? e.message : 'Move failed' });
		}
	}

	return { ok: failed.length === 0, failed };
}

export { replacePathPrefix };
