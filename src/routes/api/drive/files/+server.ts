import {
	sumSubtreeFileBytesForFolders,
	sumSubtreeFileBytesForFoldersTeam
} from '$lib/server/drive-folder-size';
import { sizeBytesJson } from '$lib/server/drive-size-json';
import { requireApiSession } from '$lib/server/require-api-session';
import { assertTeamKeyHas, resolveEffectiveTeamId } from '$lib/server/team-api-key-scope';
import { getUsersByIds, ownerDisplayName, withOwnerDisplay } from '$lib/server/auth-user-lookup';
import { db } from '$lib/server/db';
import { MainFileSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { TeamSchema } from '$lib/server/db/schema/main-schema/team.schema';
import { isTeamMember } from '$lib/server/team-access';
import { STORAGE_PROVIDERS, type StorageProviderId } from '$lib/model/storage-provider';
import { error, json } from '@sveltejs/kit';
import { and, asc, eq, isNull, ne, or } from 'drizzle-orm';
import { z } from 'zod';
import type { RequestHandler } from './$types';

function ownerDisplayNameFromRow(name: string, email: string): string {
	return ownerDisplayName(name, email);
}

export const GET: RequestHandler = async ({ request, url }) => {
	const session = await requireApiSession(request);
	assertTeamKeyHas(session, 'drive.read');

	const raw = url.searchParams.get('storageProvider') ?? 'local';
	if (!STORAGE_PROVIDERS.includes(raw as StorageProviderId)) {
		throw error(400, 'Invalid storage provider');
	}
	const storageProvider = raw as StorageProviderId;

	const teamId = resolveEffectiveTeamId(session, url);
	if (teamId && !(await isTeamMember(session.user.id, teamId))) {
		throw error(403, 'Forbidden');
	}

	const parentParam = url.searchParams.get('parentId') ?? url.searchParams.get('folder');
	let parentFilter;
	if (parentParam && parentParam.trim() !== '') {
		const parsed = z.string().uuid().safeParse(parentParam.trim());
		if (!parsed.success) throw error(400, 'Invalid folder id');
		parentFilter = eq(MainFileSchema.parentId, parsed.data);
	} else if (teamId) {
		const [trow] = await db
			.select({ root: TeamSchema.rootFolderId, sp: TeamSchema.storageProvider })
			.from(TeamSchema)
			.where(eq(TeamSchema.id, teamId))
			.limit(1);
		const root = trow?.root;
		if (!root) {
			throw error(500, 'Team root not configured');
		}
		if (trow.sp !== storageProvider) {
			throw error(400, 'Storage provider must match the team');
		}
		parentFilter = or(
			eq(MainFileSchema.parentId, root),
			and(isNull(MainFileSchema.parentId), ne(MainFileSchema.id, root))
		);
	} else {
		parentFilter = isNull(MainFileSchema.parentId);
	}

	const personalOrTeam = teamId
		? and(eq(MainFileSchema.teamId, teamId), eq(MainFileSchema.storageProvider, storageProvider))
		: and(
				eq(MainFileSchema.ownerId, session.user.id),
				isNull(MainFileSchema.teamId),
				eq(MainFileSchema.storageProvider, storageProvider)
			);

	const rowsRaw = await db
		.select({
			id: MainFileSchema.id,
			name: MainFileSchema.name,
			itemType: MainFileSchema.itemType,
			sizeBytes: MainFileSchema.sizeBytes,
			updatedAt: MainFileSchema.updatedAt,
			storageProvider: MainFileSchema.storageProvider,
			isPinned: MainFileSchema.isPinned,
			isStarred: MainFileSchema.isStarred,
			color: MainFileSchema.color,
			parentId: MainFileSchema.parentId,
			sortOrder: MainFileSchema.sortOrder,
			ownerId: MainFileSchema.ownerId
		})
		.from(MainFileSchema)
		.where(and(personalOrTeam, isNull(MainFileSchema.trashedAt), parentFilter))
		.orderBy(asc(MainFileSchema.sortOrder), asc(MainFileSchema.name));

	const users = await getUsersByIds(rowsRaw.map((r) => r.ownerId));
	const rows = withOwnerDisplay(rowsRaw, users);

	const folderIds = rows.filter((r) => r.itemType === 'folder').map((r) => r.id);
	const subtreeBytes = teamId
		? await sumSubtreeFileBytesForFoldersTeam(folderIds, teamId, storageProvider)
		: await sumSubtreeFileBytesForFolders(folderIds, session.user.id, storageProvider);

	return json({
		files: rows.map((r) => ({
			id: r.id,
			name: r.name,
			itemType: r.itemType,
			sizeBytes:
				r.itemType === 'folder'
					? sizeBytesJson(subtreeBytes.get(r.id) ?? 0n)
					: sizeBytesJson(r.sizeBytes),
			updatedAt: r.updatedAt.toISOString(),
			storageProvider: r.storageProvider,
			isPinned: r.isPinned,
			isStarred: r.isStarred,
			color: r.color,
			parentId: r.parentId ?? null,
			sortOrder: r.sortOrder,
			ownerName: ownerDisplayNameFromRow(r.ownerName, r.ownerEmail)
		}))
	});
};
