import type { StorageProviderId } from '$lib/model/storage-provider';
import { db } from '$lib/server/db';
import { MainFileSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { and, asc, eq, isNull, ne, or } from 'drizzle-orm';

export type FolderChildScope =
	| { kind: 'user'; ownerId: string; storageProvider: StorageProviderId; parentId: string | null }
	| {
			kind: 'team';
			teamId: string;
			storageProvider: StorageProviderId;
			parentId: string;
			teamRootId: string;
	  };

/**
 * Find an existing folder with the same name under the resolved parent.
 * For team root, also matches orphan folders (parent_id NULL) so portal apps
 * do not create duplicate trees.
 */
export async function findExistingFolderChild(
	scope: FolderChildScope,
	name: string
): Promise<{ id: string; parentId: string | null } | null> {
	const trimmed = name.trim();
	if (!trimmed) return null;

	const base = and(
		eq(MainFileSchema.name, trimmed),
		eq(MainFileSchema.itemType, 'folder'),
		isNull(MainFileSchema.trashedAt)
	);

	let parentFilter;
	let scopeFilter;

	if (scope.kind === 'user') {
		scopeFilter = and(
			eq(MainFileSchema.ownerId, scope.ownerId),
			isNull(MainFileSchema.teamId),
			eq(MainFileSchema.storageProvider, scope.storageProvider)
		);
		parentFilter =
			scope.parentId === null
				? isNull(MainFileSchema.parentId)
				: eq(MainFileSchema.parentId, scope.parentId);
	} else {
		scopeFilter = and(
			eq(MainFileSchema.teamId, scope.teamId),
			eq(MainFileSchema.storageProvider, scope.storageProvider)
		);
		if (scope.parentId === scope.teamRootId) {
			parentFilter = or(
				eq(MainFileSchema.parentId, scope.parentId),
				and(isNull(MainFileSchema.parentId), ne(MainFileSchema.id, scope.teamRootId))
			);
		} else {
			parentFilter = eq(MainFileSchema.parentId, scope.parentId);
		}
	}

	const rows = await db
		.select({ id: MainFileSchema.id, parentId: MainFileSchema.parentId })
		.from(MainFileSchema)
		.where(and(base, scopeFilter, parentFilter))
		.orderBy(asc(MainFileSchema.sortOrder), asc(MainFileSchema.name))
		.limit(2);

	if (rows.length === 0) return null;

	const canonical =
		scope.kind === 'team' && scope.parentId === scope.teamRootId
			? (rows.find((r) => r.parentId === scope.parentId) ?? rows[0])
			: rows[0];

	return { id: canonical.id, parentId: canonical.parentId ?? null };
}
