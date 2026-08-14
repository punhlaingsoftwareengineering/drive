import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { and, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { StorageProviderId } from '$lib/model/storage-provider';
import { db } from '$lib/server/db';
import { MainFileSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { TeamSchema } from '$lib/server/db/schema/main-schema/team.schema';
import {
	localPathNewFolderAtRoot,
	tigrisKeyNewFolderAtRootTeam
} from '$lib/server/drive-storage-layout';
import { localTeamUploadDir } from '$lib/server/local-drive-path';
import { TigrisUtil } from '$lib/service/tigris.service.svelte';

/**
 * Ensure the team has a usable root folder row (and disk/object).
 * Recreates or un-trashes when `root_folder_id` points at a missing/trashed row —
 * common after DB restores, volume resets, or partial migrations.
 */
export async function ensureTeamRootFolder(
	teamId: string,
	expectedStorageProvider?: StorageProviderId
): Promise<{ id: string; path: string }> {
	const [team] = await db
		.select({
			id: TeamSchema.id,
			name: TeamSchema.name,
			rootFolderId: TeamSchema.rootFolderId,
			storageProvider: TeamSchema.storageProvider,
			createdByUserId: TeamSchema.createdByUserId
		})
		.from(TeamSchema)
		.where(eq(TeamSchema.id, teamId))
		.limit(1);

	if (!team) throw error(404, 'Team not found');

	const sp = team.storageProvider as StorageProviderId;
	if (expectedStorageProvider && expectedStorageProvider !== sp) {
		throw error(400, 'Storage provider must match the team');
	}

	if (team.rootFolderId) {
		const [row] = await db
			.select({
				id: MainFileSchema.id,
				path: MainFileSchema.path,
				teamId: MainFileSchema.teamId,
				itemType: MainFileSchema.itemType,
				storageProvider: MainFileSchema.storageProvider,
				trashedAt: MainFileSchema.trashedAt
			})
			.from(MainFileSchema)
			.where(eq(MainFileSchema.id, team.rootFolderId))
			.limit(1);

		if (
			row &&
			row.teamId === teamId &&
			row.itemType === 'folder' &&
			row.storageProvider === sp
		) {
			if (row.trashedAt) {
				await db
					.update(MainFileSchema)
					.set({ trashedAt: null })
					.where(eq(MainFileSchema.id, row.id));
			}
			if (sp === 'local') {
				await mkdir(row.path, { recursive: true }).catch(() => undefined);
			}
			return { id: row.id, path: row.path };
		}
	}

	const rootFolderId = team.rootFolderId ?? randomUUID();
	const ownerId = team.createdByUserId;
	const folderName = team.name.trim() || 'Team';

	let path: string;
	if (sp === 'local') {
		const teamDir = localTeamUploadDir(teamId);
		path = localPathNewFolderAtRoot(teamDir, rootFolderId);
		await mkdir(path, { recursive: true });
	} else {
		path = tigrisKeyNewFolderAtRootTeam(teamId, rootFolderId);
		try {
			await TigrisUtil.upload(path, Buffer.alloc(0), {
				contentType: 'application/octet-stream'
			});
		} catch (e) {
			console.error('[ensureTeamRootFolder] Tigris upload failed', e);
			throw error(500, 'Failed to repair team root storage');
		}
	}

	const [existingById] = await db
		.select({ id: MainFileSchema.id })
		.from(MainFileSchema)
		.where(eq(MainFileSchema.id, rootFolderId))
		.limit(1);

	if (existingById) {
		await db
			.update(MainFileSchema)
			.set({
				ownerId,
				teamId,
				parentId: null,
				itemType: 'folder',
				path,
				name: folderName,
				mimeType: 'inode/directory',
				sizeBytes: 0n,
				storageProvider: sp,
				trashedAt: null,
				isEncrypted: false,
				isCompressed: false
			})
			.where(eq(MainFileSchema.id, rootFolderId));
	} else {
		await db.insert(MainFileSchema).values({
			id: rootFolderId,
			ownerId,
			teamId,
			parentId: null,
			itemType: 'folder',
			path,
			name: folderName,
			mimeType: 'inode/directory',
			sizeBytes: 0n,
			storageProvider: sp,
			isPinned: false,
			isStarred: false,
			trashedAt: null,
			isEncrypted: false,
			isCompressed: false,
			color: null
		});
	}

	if (team.rootFolderId !== rootFolderId) {
		await db.update(TeamSchema).set({ rootFolderId }).where(eq(TeamSchema.id, teamId));
	}

	console.warn(`[ensureTeamRootFolder] repaired team ${teamId} root ${rootFolderId}`);
	return { id: rootFolderId, path };
}

/** @deprecated Prefer ensureTeamRootFolder — kept for call-site clarity. */
export async function repairTeamRootFolder(teamId: string): Promise<{ id: string; path: string }> {
	return ensureTeamRootFolder(teamId);
}
