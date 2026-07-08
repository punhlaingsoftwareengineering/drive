import { canAccessSharedItem, sharedRootIdsForRecipient } from '$lib/server/drive-shared-access';
import { sizeBytesJson } from '$lib/server/drive-size-json';
import { assertTeamKeyHas } from '$lib/server/team-api-key-scope';
import { requireApiSession } from '$lib/server/require-api-session';
import {
	sumSubtreeFileBytesForFolderRows,
	sumSubtreeFileBytesForFoldersTeam
} from '$lib/server/drive-folder-size';
import { resolveTeamApiContext } from '$lib/server/team-api-scope';
import { getUsersByIds, ownerDisplayName } from '$lib/server/auth-user-lookup';
import { db } from '$lib/server/db';
import { MainFileSchema, MainFileShareSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { STORAGE_PROVIDERS, type StorageProviderId } from '$lib/model/storage-provider';
import { error, json } from '@sveltejs/kit';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { RequestHandler } from './$types';


type FileRowBase = {
	id: string;
	ownerId: string;
	name: string;
	itemType: string;
	sizeBytes: unknown;
	updatedAt: Date;
	storageProvider: string;
	isPinned: boolean;
	isStarred: boolean;
	color: string | null;
	parentId: string | null;
	permission?: string;
};

async function enrichFileRows<T extends FileRowBase>(
	rows: T[]
): Promise<Array<T & { ownerName: string | null; ownerEmail: string }>> {
	const users = await getUsersByIds(rows.map((r) => r.ownerId));
	return rows.map((r) => {
		const u = users.get(r.ownerId);
		const email = u?.email ?? '';
		return {
			...r,
			ownerEmail: email,
			ownerName: u?.name ?? null
		};
	});
}

function mapFileRow(
	r: FileRowBase & { ownerName: string | null; ownerEmail: string },
	subtreeBytes: Map<string, number>
) {
	return {
		id: r.id,
		name: r.name,
		itemType: r.itemType,
		sizeBytes:
			r.itemType === 'folder'
				? (subtreeBytes.get(r.id) ?? 0)
				: sizeBytesJson(r.sizeBytes as bigint | number),
		updatedAt: r.updatedAt.toISOString(),
		storageProvider: r.storageProvider,
		isPinned: r.isPinned,
		isStarred: r.isStarred,
		color: r.color,
		parentId: r.parentId ?? null,
		ownerName: ownerDisplayName(r.ownerName, r.ownerEmail),
		...(r.permission ? { sharePermission: r.permission } : {})
	};
}

async function listTeamOutboundSharedRoots(teamId: string, storageProvider: StorageProviderId) {
	const sharedFileIds = await db
		.selectDistinct({ fileId: MainFileShareSchema.fileId })
		.from(MainFileShareSchema)
		.innerJoin(MainFileSchema, eq(MainFileShareSchema.fileId, MainFileSchema.id))
		.where(
			and(
				eq(MainFileSchema.teamId, teamId),
				eq(MainFileSchema.storageProvider, storageProvider),
				isNull(MainFileSchema.trashedAt)
			)
		);

	const ids = sharedFileIds.map((r) => r.fileId);
	if (ids.length === 0) return [];

	const filesRaw = await db
		.select({
			id: MainFileSchema.id,
			ownerId: MainFileSchema.ownerId,
			name: MainFileSchema.name,
			itemType: MainFileSchema.itemType,
			sizeBytes: MainFileSchema.sizeBytes,
			updatedAt: MainFileSchema.updatedAt,
			storageProvider: MainFileSchema.storageProvider,
			isPinned: MainFileSchema.isPinned,
			isStarred: MainFileSchema.isStarred,
			color: MainFileSchema.color,
			parentId: MainFileSchema.parentId,
			permission: MainFileShareSchema.permission
		})
		.from(MainFileSchema)
		.innerJoin(MainFileShareSchema, eq(MainFileShareSchema.fileId, MainFileSchema.id))
		.where(inArray(MainFileSchema.id, ids));

	const files = await enrichFileRows(filesRaw);

	const byId = new Map(files.map((f) => [f.id, f]));
	const sharedSet = new Set(ids);

	return [...byId.values()].filter((f) => {
		if (!f.parentId) return true;
		let parentId: string | null = f.parentId;
		while (parentId) {
			if (sharedSet.has(parentId)) return false;
			const parent = byId.get(parentId);
			if (!parent) break;
			parentId = parent.parentId;
		}
		return true;
	});
}

export const GET: RequestHandler = async ({ request, url }) => {
	const session = await requireApiSession(request);
	assertTeamKeyHas(session, 'drive.read');
	const teamCtx = await resolveTeamApiContext(session.user.id, url, session);

	const raw = url.searchParams.get('storageProvider') ?? 'local';
	if (!STORAGE_PROVIDERS.includes(raw as StorageProviderId)) {
		throw error(400, 'Invalid storage provider');
	}
	const storageProvider = teamCtx?.storageProvider ?? (raw as StorageProviderId);

	const folderParam = url.searchParams.get('parentId') ?? url.searchParams.get('folder');

	if (teamCtx) {
		const teamId = teamCtx.teamId;

		if (folderParam && folderParam.trim() !== '') {
			const parsed = z.string().uuid().safeParse(folderParam.trim());
			if (!parsed.success) throw error(400, 'Invalid folder id');

			const [parentFolder] = await db
				.select({
					id: MainFileSchema.id,
					itemType: MainFileSchema.itemType
				})
				.from(MainFileSchema)
				.where(
					and(
						eq(MainFileSchema.id, parsed.data),
						eq(MainFileSchema.teamId, teamId),
						eq(MainFileSchema.storageProvider, storageProvider),
						isNull(MainFileSchema.trashedAt)
					)
				)
				.limit(1);

			if (!parentFolder || parentFolder.itemType !== 'folder') {
				throw error(404, 'Folder not found');
			}

			const rowsRaw = await db
				.select({
					id: MainFileSchema.id,
					ownerId: MainFileSchema.ownerId,
					name: MainFileSchema.name,
					itemType: MainFileSchema.itemType,
					sizeBytes: MainFileSchema.sizeBytes,
					updatedAt: MainFileSchema.updatedAt,
					storageProvider: MainFileSchema.storageProvider,
					isPinned: MainFileSchema.isPinned,
					isStarred: MainFileSchema.isStarred,
					color: MainFileSchema.color,
					parentId: MainFileSchema.parentId
				})
				.from(MainFileSchema)
				.where(
					and(
						eq(MainFileSchema.parentId, parsed.data),
						eq(MainFileSchema.teamId, teamId),
						eq(MainFileSchema.storageProvider, storageProvider),
						isNull(MainFileSchema.trashedAt)
					)
				);

			const rows = await enrichFileRows(rowsRaw);

			const folderRows = rows.filter((r) => r.itemType === 'folder');
			const subtreeBytes = await sumSubtreeFileBytesForFoldersTeam(
				folderRows.map((r) => r.id),
				teamId,
				storageProvider
			);

			return json({
				shared: true,
				outbound: true,
				files: rows.map((r) => mapFileRow(r, subtreeBytes))
			});
		}

		const roots = await listTeamOutboundSharedRoots(teamId, storageProvider);
		const folderRows = roots.filter((r) => r.itemType === 'folder');
		const subtreeBytes = await sumSubtreeFileBytesForFoldersTeam(
			folderRows.map((r) => r.id),
			teamId,
			storageProvider
		);

		return json({
			shared: true,
			outbound: true,
			files: roots.map((r) => mapFileRow(r, subtreeBytes))
		});
	}

	const email = session.user.email?.trim().toLowerCase();
	if (!email) throw error(400, 'Account has no email; sharing requires an email address');

	const sharedRoots = await sharedRootIdsForRecipient(email);

	if (folderParam && folderParam.trim() !== '') {
		const parsed = z.string().uuid().safeParse(folderParam.trim());
		if (!parsed.success) throw error(400, 'Invalid folder id');

		if (!(await canAccessSharedItem(email, parsed.data, sharedRoots))) {
			throw error(403, 'You do not have access to this folder');
		}

		const [parentFolder] = await db
			.select({
				id: MainFileSchema.id,
				ownerId: MainFileSchema.ownerId,
				itemType: MainFileSchema.itemType
			})
			.from(MainFileSchema)
			.where(
				and(
					eq(MainFileSchema.id, parsed.data),
					eq(MainFileSchema.storageProvider, storageProvider),
					isNull(MainFileSchema.trashedAt)
				)
			)
			.limit(1);

		if (!parentFolder || parentFolder.itemType !== 'folder') {
			throw error(404, 'Folder not found');
		}

		const rowsRaw = await db
			.select({
				id: MainFileSchema.id,
				ownerId: MainFileSchema.ownerId,
				name: MainFileSchema.name,
				itemType: MainFileSchema.itemType,
				sizeBytes: MainFileSchema.sizeBytes,
				updatedAt: MainFileSchema.updatedAt,
				storageProvider: MainFileSchema.storageProvider,
				isPinned: MainFileSchema.isPinned,
				isStarred: MainFileSchema.isStarred,
				color: MainFileSchema.color,
				parentId: MainFileSchema.parentId
			})
			.from(MainFileSchema)
			.where(
				and(
					eq(MainFileSchema.parentId, parsed.data),
					eq(MainFileSchema.ownerId, parentFolder.ownerId),
					eq(MainFileSchema.storageProvider, storageProvider),
					isNull(MainFileSchema.trashedAt)
				)
			);

		const rows = await enrichFileRows(rowsRaw);

		const folderRows = rows.filter((r) => r.itemType === 'folder');
		const subtreeBytes = await sumSubtreeFileBytesForFolderRows(
			folderRows.map((r) => ({
				id: r.id,
				ownerId: r.ownerId,
				storageProvider: r.storageProvider as StorageProviderId
			}))
		);

		return json({
			shared: true,
			files: rows.map((r) => mapFileRow(r, subtreeBytes))
		});
	}

	const rowsRaw = await db
		.select({
			id: MainFileSchema.id,
			ownerId: MainFileSchema.ownerId,
			name: MainFileSchema.name,
			itemType: MainFileSchema.itemType,
			sizeBytes: MainFileSchema.sizeBytes,
			updatedAt: MainFileSchema.updatedAt,
			storageProvider: MainFileSchema.storageProvider,
			isPinned: MainFileSchema.isPinned,
			isStarred: MainFileSchema.isStarred,
			color: MainFileSchema.color,
			parentId: MainFileSchema.parentId,
			permission: MainFileShareSchema.permission
		})
		.from(MainFileShareSchema)
		.innerJoin(MainFileSchema, eq(MainFileShareSchema.fileId, MainFileSchema.id))
		.where(
			and(
				eq(MainFileShareSchema.targetEmail, email),
				eq(MainFileSchema.storageProvider, storageProvider),
				isNull(MainFileSchema.trashedAt)
			)
		);

	const rows = await enrichFileRows(rowsRaw);

	const folderRows = rows.filter((r) => r.itemType === 'folder');
	const subtreeBytes = await sumSubtreeFileBytesForFolderRows(
		folderRows.map((r) => ({
			id: r.id,
			ownerId: r.ownerId,
			storageProvider: r.storageProvider as StorageProviderId
		}))
	);

	return json({
		shared: true,
		files: rows.map((r) => mapFileRow(r, subtreeBytes))
	});
};
