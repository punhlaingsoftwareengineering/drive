import { canAccessSharedItem, sharedRootIdsForRecipient } from '$lib/server/drive-shared-access';
import { sizeBytesJson } from '$lib/server/drive-size-json';
import { requireApiSession } from '$lib/server/require-api-session';
import { sumSubtreeFileBytesForFolderRows } from '$lib/server/drive-folder-size';
import { db } from '$lib/server/db';
import { AuthUserSchema } from '$lib/server/db/schema/auth-schema/auth.schema';
import { MainFileSchema, MainFileShareSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { STORAGE_PROVIDERS, type StorageProviderId } from '$lib/model/storage-provider';
import { error, json } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { RequestHandler } from './$types';

function ownerDisplayName(name: string | null | undefined, email: string): string {
	const n = name?.trim();
	return n || email;
}

export const GET: RequestHandler = async ({ request, url }) => {
	const session = await requireApiSession(request);

	const email = session.user.email?.trim().toLowerCase();
	if (!email) throw error(400, 'Account has no email; sharing requires an email address');

	const raw = url.searchParams.get('storageProvider') ?? 'local';
	if (!STORAGE_PROVIDERS.includes(raw as StorageProviderId)) {
		throw error(400, 'Invalid storage provider');
	}
	const storageProvider = raw as StorageProviderId;

	const folderParam = url.searchParams.get('parentId') ?? url.searchParams.get('folder');

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

		const rows = await db
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
				ownerName: AuthUserSchema.name,
				ownerEmail: AuthUserSchema.email
			})
			.from(MainFileSchema)
			.innerJoin(AuthUserSchema, eq(MainFileSchema.ownerId, AuthUserSchema.id))
			.where(
				and(
					eq(MainFileSchema.parentId, parsed.data),
					eq(MainFileSchema.ownerId, parentFolder.ownerId),
					eq(MainFileSchema.storageProvider, storageProvider),
					isNull(MainFileSchema.trashedAt)
				)
			);

		const folderRows = rows.filter((r) => r.itemType === 'folder');
		const subtreeBytes = await sumSubtreeFileBytesForFolderRows(
			folderRows.map((r) => ({
				id: r.id,
				ownerId: r.ownerId,
				storageProvider: r.storageProvider
			}))
		);

		return json({
			shared: true,
			files: rows.map((r) => ({
				id: r.id,
				name: r.name,
				itemType: r.itemType,
				sizeBytes:
					r.itemType === 'folder'
						? (subtreeBytes.get(r.id) ?? 0)
						: sizeBytesJson(r.sizeBytes),
				updatedAt: r.updatedAt.toISOString(),
				storageProvider: r.storageProvider,
				isPinned: r.isPinned,
				isStarred: r.isStarred,
				color: r.color,
				parentId: r.parentId ?? null,
				ownerName: ownerDisplayName(r.ownerName, r.ownerEmail)
			}))
		});
	}

	const rows = await db
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
			ownerName: AuthUserSchema.name,
			ownerEmail: AuthUserSchema.email,
			permission: MainFileShareSchema.permission
		})
		.from(MainFileShareSchema)
		.innerJoin(MainFileSchema, eq(MainFileShareSchema.fileId, MainFileSchema.id))
		.innerJoin(AuthUserSchema, eq(MainFileSchema.ownerId, AuthUserSchema.id))
		.where(
			and(
				eq(MainFileShareSchema.targetEmail, email),
				eq(MainFileSchema.storageProvider, storageProvider),
				isNull(MainFileSchema.trashedAt)
			)
		);

	const folderRows = rows.filter((r) => r.itemType === 'folder');
	const subtreeBytes = await sumSubtreeFileBytesForFolderRows(
		folderRows.map((r) => ({
			id: r.id,
			ownerId: r.ownerId,
			storageProvider: r.storageProvider
		}))
	);

	return json({
		shared: true,
		files: rows.map((r) => ({
			id: r.id,
			name: r.name,
			itemType: r.itemType,
			sizeBytes:
				r.itemType === 'folder'
					? (subtreeBytes.get(r.id) ?? 0)
					: sizeBytesJson(r.sizeBytes),
			updatedAt: r.updatedAt.toISOString(),
			storageProvider: r.storageProvider,
			isPinned: r.isPinned,
			isStarred: r.isStarred,
			color: r.color,
			parentId: r.parentId ?? null,
			ownerName: ownerDisplayName(r.ownerName, r.ownerEmail),
			sharePermission: r.permission
		}))
	});
};
