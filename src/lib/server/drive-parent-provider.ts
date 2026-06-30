import type { StorageProviderId } from '$lib/model/storage-provider';
import { storageProviderLabel } from '$lib/model/storage-provider';
import { db } from '$lib/server/db';
import { MainFileSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { isTeamMember } from '$lib/server/team-access';
import { error } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

async function lookupParentFolder(
	parentId: string,
	scope: { kind: 'user'; ownerId: string } | { kind: 'team'; teamId: string; memberUserId: string }
) {
	if (scope.kind === 'team' && !(await isTeamMember(scope.memberUserId, scope.teamId))) {
		throw error(403, 'Forbidden');
	}

	const [row] = await db
		.select({
			id: MainFileSchema.id,
			storageProvider: MainFileSchema.storageProvider,
			itemType: MainFileSchema.itemType,
			trashedAt: MainFileSchema.trashedAt
		})
		.from(MainFileSchema)
		.where(
			and(
				eq(MainFileSchema.id, parentId),
				scope.kind === 'user'
					? and(eq(MainFileSchema.ownerId, scope.ownerId), isNull(MainFileSchema.teamId))
					: eq(MainFileSchema.teamId, scope.teamId),
				eq(MainFileSchema.itemType, 'folder'),
				isNull(MainFileSchema.trashedAt)
			)
		)
		.limit(1);

	return row ?? null;
}

/** Clear 400 when navbar storage target does not match the folder's provider. */
export async function assertParentFolderStorageProvider(
	storageProvider: StorageProviderId,
	parentIdRaw: unknown,
	scope: { kind: 'user'; ownerId: string } | { kind: 'team'; teamId: string; memberUserId: string }
): Promise<void> {
	if (parentIdRaw === undefined || parentIdRaw === null || parentIdRaw === '') return;
	if (typeof parentIdRaw !== 'string') throw error(400, 'Invalid parent folder');
	const parsed = z.string().uuid().safeParse(parentIdRaw.trim());
	if (!parsed.success) throw error(400, 'Invalid parent folder id');

	const row = await lookupParentFolder(parsed.data, scope);
	if (!row) throw error(400, 'Parent folder not found');
	if (row.storageProvider !== storageProvider) {
		throw error(
			400,
			`Folder was created under ${storageProviderLabel(row.storageProvider)}; switch storage target or open a matching folder.`
		);
	}
}
