import { db } from '$lib/server/db';
import { MainFileSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { eq } from 'drizzle-orm';

export type FolderAncestor = { id: string; name: string; href: string };

/** Walk parentId chain from `startParentId` up to (but not including) `stopAtId`. */
export async function listFolderAncestors(
	startParentId: string | null,
	stopAtId: string | null,
	buildHref: (folderId: string) => string
): Promise<FolderAncestor[]> {
	const ancestors: FolderAncestor[] = [];
	let currentId = startParentId;
	const seen = new Set<string>();

	while (currentId && currentId !== stopAtId) {
		if (seen.has(currentId)) break;
		seen.add(currentId);

		const [row] = await db
			.select({ id: MainFileSchema.id, name: MainFileSchema.name, parentId: MainFileSchema.parentId })
			.from(MainFileSchema)
			.where(eq(MainFileSchema.id, currentId))
			.limit(1);

		if (!row) break;
		ancestors.unshift({ id: row.id, name: row.name, href: buildHref(row.id) });
		currentId = row.parentId ?? null;
	}

	return ancestors;
}
