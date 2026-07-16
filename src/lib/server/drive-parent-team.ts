import type { StorageProviderId } from '$lib/model/storage-provider';
import { db } from '$lib/server/db';
import { MainFileSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { TeamSchema } from '$lib/server/db/schema/main-schema/team.schema';
import { isTeamMember } from '$lib/server/team-access';
import { error } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

async function loadTeamRootFolder(
	teamId: string,
	storageProvider: StorageProviderId
): Promise<{ id: string; path: string }> {
	const [team] = await db
		.select({ root: TeamSchema.rootFolderId, sp: TeamSchema.storageProvider })
		.from(TeamSchema)
		.where(eq(TeamSchema.id, teamId))
		.limit(1);

	if (!team?.root) throw error(500, 'Team root not configured');
	if (team.sp !== storageProvider) {
		throw error(400, 'Storage provider must match the team');
	}

	const [row] = await db
		.select({ id: MainFileSchema.id, path: MainFileSchema.path })
		.from(MainFileSchema)
		.where(
			and(
				eq(MainFileSchema.id, team.root),
				eq(MainFileSchema.teamId, teamId),
				eq(MainFileSchema.storageProvider, storageProvider),
				eq(MainFileSchema.itemType, 'folder'),
				isNull(MainFileSchema.trashedAt)
			)
		)
		.limit(1);

	if (!row) {
		throw error(400, 'Team root folder not found. Ask an admin to repair the team drive.');
	}

	return row;
}

export async function resolveParentFolderForTeam(
	memberUserId: string,
	teamId: string,
	storageProvider: StorageProviderId,
	parentIdRaw: unknown
): Promise<{ id: string; path: string } | null> {
	if (!(await isTeamMember(memberUserId, teamId))) {
		throw error(403, 'Not a team member');
	}
	if (parentIdRaw === undefined || parentIdRaw === null || parentIdRaw === '') {
		return loadTeamRootFolder(teamId, storageProvider);
	}
	if (typeof parentIdRaw !== 'string') throw error(400, 'Invalid parent folder');
	const parsed = z.string().uuid().safeParse(parentIdRaw.trim());
	if (!parsed.success) throw error(400, 'Invalid parent folder id');

	const [row] = await db
		.select({ id: MainFileSchema.id, path: MainFileSchema.path })
		.from(MainFileSchema)
		.where(
			and(
				eq(MainFileSchema.id, parsed.data),
				eq(MainFileSchema.teamId, teamId),
				eq(MainFileSchema.storageProvider, storageProvider),
				eq(MainFileSchema.itemType, 'folder'),
				isNull(MainFileSchema.trashedAt)
			)
		)
		.limit(1);

	if (!row) {
		const [team] = await db
			.select({ root: TeamSchema.rootFolderId })
			.from(TeamSchema)
			.where(eq(TeamSchema.id, teamId))
			.limit(1);
		if (team?.root === parsed.data) {
			return loadTeamRootFolder(teamId, storageProvider);
		}
		throw error(400, 'Parent folder not found');
	}
	return { id: row.id, path: row.path };
}
