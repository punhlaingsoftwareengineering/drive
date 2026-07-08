import { db } from '$lib/server/db';
import { TeamSchema } from '$lib/server/db/schema/main-schema/team.schema';
import { assertDeveloperApiCanCreate } from '$lib/server/developer-api-limits';
import { requireApiSession } from '$lib/server/require-api-session';
import { assertTeamKeyCanCreateTeam } from '$lib/server/team-api-key-scope';
import { createTeamWithRoot } from '$lib/server/team-create-root';
import { listTeamsForUser } from '$lib/server/team-access';
import { STORAGE_PROVIDERS, type StorageProviderId } from '$lib/model/storage-provider';
import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const createSchema = z
	.object({
		name: z.string().min(1).max(200),
		storageProvider: z.enum(['local', 'tigris']).optional(),
		inviteEmails: z.array(z.string().min(1)).max(50).optional().default([])
	})
	.strict();

export const GET: RequestHandler = async ({ request }) => {
	const session = await requireApiSession(request);
	if (session.apiKeyTeamId) {
		const [team] = await db
			.select({ id: TeamSchema.id, name: TeamSchema.name, slug: TeamSchema.slug })
			.from(TeamSchema)
			.where(eq(TeamSchema.id, session.apiKeyTeamId))
			.limit(1);
		return json({ teams: team ? [team] : [] });
	}
	const teams = await listTeamsForUser(session.user.id);
	return json({ teams });
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await requireApiSession(request);
	assertTeamKeyCanCreateTeam(session);
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}
	const parsed = createSchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.message);

	const sp = (parsed.data.storageProvider ?? 'local') as StorageProviderId;
	if (!STORAGE_PROVIDERS.includes(sp)) {
		throw error(400, 'Invalid storage provider');
	}

	const inviteEmails = parsed.data.inviteEmails.map((e) => String(e).trim());

	await assertDeveloperApiCanCreate(session, 'teams');

	try {
		const out = await createTeamWithRoot({
			creatorId: session.user.id,
			creatorEmail: session.user.email,
			name: parsed.data.name,
			storageProvider: sp,
			inviteEmails,
			createdByApiKeyId: session.apiKeyId ?? null
		});
		return json({ ok: true, ...out });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Failed to create team';
		if (msg.includes('Tigris')) {
			throw error(502, msg);
		}
		console.error('[api/teams POST]', e);
		throw error(500, msg);
	}
};
