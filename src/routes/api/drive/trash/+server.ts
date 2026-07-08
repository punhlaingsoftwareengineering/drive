import { TRASH_RETENTION_DAYS } from '$lib/server/drive-trash-constants';
import { sizeBytesJson } from '$lib/server/drive-size-json';
import { assertTeamKeyHas } from '$lib/server/team-api-key-scope';
import { requireApiSession } from '$lib/server/require-api-session';
import {
	sumSubtreeFileBytesForTrashedFolderRows,
	sumSubtreeFileBytesForTrashedFolderRowsTeam
} from '$lib/server/drive-folder-size';
import { resolveTeamApiContext } from '$lib/server/team-api-scope';
import { getUsersByIds, ownerDisplayName, withOwnerDisplay } from '$lib/server/auth-user-lookup';
import { db } from '$lib/server/db';
import { MainFileSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { STORAGE_PROVIDERS, type StorageProviderId } from '$lib/model/storage-provider';
import { error, json } from '@sveltejs/kit';
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
	const session = await requireApiSession(request);
	assertTeamKeyHas(session, 'drive.read');
	const teamCtx = await resolveTeamApiContext(session.user.id, url, session);

	const raw = url.searchParams.get('storageProvider') ?? 'local';
	if (!STORAGE_PROVIDERS.includes(raw as StorageProviderId)) {
		throw error(400, 'Invalid storage provider');
	}
	const storageProvider = teamCtx?.storageProvider ?? (raw as StorageProviderId);

	const scopeFilter = teamCtx
		? and(
				eq(MainFileSchema.teamId, teamCtx.teamId),
				eq(MainFileSchema.storageProvider, storageProvider),
				isNotNull(MainFileSchema.trashedAt)
			)
		: and(
				eq(MainFileSchema.ownerId, session.user.id),
				isNull(MainFileSchema.teamId),
				eq(MainFileSchema.storageProvider, storageProvider),
				isNotNull(MainFileSchema.trashedAt)
			);

	const rowsRaw = await db
		.select({
			id: MainFileSchema.id,
			ownerId: MainFileSchema.ownerId,
			teamId: MainFileSchema.teamId,
			name: MainFileSchema.name,
			itemType: MainFileSchema.itemType,
			sizeBytes: MainFileSchema.sizeBytes,
			updatedAt: MainFileSchema.updatedAt,
			trashedAt: MainFileSchema.trashedAt,
			storageProvider: MainFileSchema.storageProvider,
			isPinned: MainFileSchema.isPinned,
			isStarred: MainFileSchema.isStarred,
			color: MainFileSchema.color,
			parentId: MainFileSchema.parentId
		})
		.from(MainFileSchema)
		.where(scopeFilter)
		.orderBy(desc(MainFileSchema.trashedAt));

	const users = await getUsersByIds(rowsRaw.map((r) => r.ownerId));
	const rows = withOwnerDisplay(rowsRaw, users);

	const folderRows = rows.filter((r) => r.itemType === 'folder');
	const subtreeBytes = teamCtx
		? await sumSubtreeFileBytesForTrashedFolderRowsTeam(
				folderRows.map((r) => ({
					id: r.id,
					teamId: teamCtx.teamId,
					storageProvider: r.storageProvider as StorageProviderId
				}))
			)
		: await sumSubtreeFileBytesForTrashedFolderRows(
				folderRows.map((r) => ({
					id: r.id,
					ownerId: r.ownerId,
					storageProvider: r.storageProvider as StorageProviderId
				}))
			);

	return json({
		trashRetentionDays: TRASH_RETENTION_DAYS,
		files: rows.map((r) => {
			const trashedAt = r.trashedAt!;
			const purgeAt = new Date(trashedAt.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
			return {
				id: r.id,
				name: r.name,
				itemType: r.itemType,
				sizeBytes:
					r.itemType === 'folder' ? (subtreeBytes.get(r.id) ?? 0) : sizeBytesJson(r.sizeBytes),
				updatedAt: r.updatedAt.toISOString(),
				trashedAt: trashedAt.toISOString(),
				purgeAt: purgeAt.toISOString(),
				storageProvider: r.storageProvider,
				isPinned: r.isPinned,
				isStarred: r.isStarred,
				color: r.color,
				parentId: r.parentId ?? null,
				ownerName: ownerDisplayName(r.ownerName, r.ownerEmail)
			};
		})
	});
};
