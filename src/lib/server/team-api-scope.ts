import { db } from '$lib/server/db';
import { TeamSchema } from '$lib/server/db/schema/main-schema/team.schema';
import type { StorageProviderId } from '$lib/model/storage-provider';
import { STORAGE_PROVIDERS } from '$lib/model/storage-provider';
import { isTeamMember, requireTeamMember } from '$lib/server/team-access';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export type TeamApiContext = {
	teamId: string;
	storageProvider: StorageProviderId;
};

/** When `teamId` query param is present, resolve team and enforce membership. */
export async function resolveTeamApiContext(
	userId: string,
	url: URL
): Promise<TeamApiContext | null> {
	const rawTeamId = url.searchParams.get('teamId');
	if (!rawTeamId || rawTeamId.trim() === '') return null;

	const parsed = z.string().uuid().safeParse(rawTeamId.trim());
	if (!parsed.success) throw error(400, 'Invalid team id');

	const [team] = await db
		.select({
			id: TeamSchema.id,
			storageProvider: TeamSchema.storageProvider
		})
		.from(TeamSchema)
		.where(eq(TeamSchema.id, parsed.data))
		.limit(1);

	if (!team) throw error(404, 'Team not found');

	await requireTeamMember(userId, team.id);

	const sp = team.storageProvider;
	if (!STORAGE_PROVIDERS.includes(sp as StorageProviderId)) {
		throw error(500, 'Invalid team storage provider');
	}

	return { teamId: team.id, storageProvider: sp as StorageProviderId };
}
