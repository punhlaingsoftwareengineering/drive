import type { DriveApiSession } from '$lib/server/require-api-session';
import { resolveEffectiveTeamId } from '$lib/server/team-api-key-scope';
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

/** When `teamId` query param is present (or bound on a team API key), resolve team context. */
export async function resolveTeamApiContext(
	userId: string,
	url: URL,
	session?: DriveApiSession
): Promise<TeamApiContext | null> {
	const effectiveTeamId = session
		? resolveEffectiveTeamId(session, url)
		: (() => {
				const rawTeamId = url.searchParams.get('teamId');
				if (!rawTeamId || rawTeamId.trim() === '') return null;
				const parsed = z.string().uuid().safeParse(rawTeamId.trim());
				if (!parsed.success) throw error(400, 'Invalid team id');
				return parsed.data;
			})();

	if (!effectiveTeamId) return null;
	const [team] = await db
		.select({
			id: TeamSchema.id,
			storageProvider: TeamSchema.storageProvider
		})
		.from(TeamSchema)
		.where(eq(TeamSchema.id, effectiveTeamId))
		.limit(1);

	if (!team) throw error(404, 'Team not found');

	await requireTeamMember(userId, team.id);

	const sp = team.storageProvider;
	if (!STORAGE_PROVIDERS.includes(sp as StorageProviderId)) {
		throw error(500, 'Invalid team storage provider');
	}

	return { teamId: team.id, storageProvider: sp as StorageProviderId };
}
