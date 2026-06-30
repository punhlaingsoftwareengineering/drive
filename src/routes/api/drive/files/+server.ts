import {
	sumSubtreeFileBytesForFolders,
	sumSubtreeFileBytesForFoldersTeam
} from '$lib/server/drive-folder-size';
import { sizeBytesJson } from '$lib/server/drive-size-json';
import { requireApiSession } from '$lib/server/require-api-session';
import { db } from '$lib/server/db';
import { AuthUserSchema } from '$lib/server/db/schema/auth-schema/auth.schema';
import { MainFileSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { TeamSchema } from '$lib/server/db/schema/main-schema/team.schema';
import { isTeamMember } from '$lib/server/team-access';
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

	const raw = url.searchParams.get('storageProvider') ?? 'local';
	if (!STORAGE_PROVIDERS.includes(raw as StorageProviderId)) {
		throw error(400, 'Invalid storage provider');
	}
	const storageProvider = raw as StorageProviderId;

	const teamParam = url.searchParams.get('teamId');
	let teamId: string | null = null;
	if (teamParam && teamParam.trim() !== '') {
		const t = z.string().uuid().safeParse(teamParam.trim());
		if (!t.success) throw error(400, 'Invalid team id');
		teamId = t.data;
		if (!(await isTeamMember(session.user.id, teamId))) {
			throw error(403, 'Forbidden');
		}
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
		parentFilter = eq(MainFileSchema.parentId, root);
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

	const rows = await db
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
			ownerName: AuthUserSchema.name,
			ownerEmail: AuthUserSchema.email
		})
		.from(MainFileSchema)
		.innerJoin(AuthUserSchema, eq(MainFileSchema.ownerId, AuthUserSchema.id))
		.where(and(personalOrTeam, isNull(MainFileSchema.trashedAt), parentFilter));

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
			ownerName: ownerDisplayName(r.ownerName, r.ownerEmail)
		}))
	});
};
