import type { StorageProviderId } from '$lib/model/storage-provider';
import { db } from '$lib/server/db';
import { MainFileSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { and, eq, isNull, max } from 'drizzle-orm';

/** Next manual sort index for a new item in the same folder listing. */
export async function nextSortOrderInParent(
	parentId: string | null,
	scope:
		| { kind: 'user'; ownerId: string; storageProvider: StorageProviderId }
		| { kind: 'team'; teamId: string; storageProvider: StorageProviderId }
): Promise<number> {
	const parentFilter = parentId
		? eq(MainFileSchema.parentId, parentId)
		: isNull(MainFileSchema.parentId);

	const scopeFilter =
		scope.kind === 'team'
			? and(
					eq(MainFileSchema.teamId, scope.teamId),
					eq(MainFileSchema.storageProvider, scope.storageProvider)
				)
			: and(
					eq(MainFileSchema.ownerId, scope.ownerId),
					isNull(MainFileSchema.teamId),
					eq(MainFileSchema.storageProvider, scope.storageProvider)
				);

	const [row] = await db
		.select({ m: max(MainFileSchema.sortOrder) })
		.from(MainFileSchema)
		.where(and(parentFilter, scopeFilter, isNull(MainFileSchema.trashedAt)));

	const currentMax = row?.m ?? null;
	return (typeof currentMax === 'number' ? currentMax : -1) + 1;
}
