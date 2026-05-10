import { inviteEmailsToExistingTeam } from '$lib/server/team-create-root';
import { requireApiSession } from '$lib/server/require-api-session';
import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const bodySchema = z
	.object({
		inviteEmails: z.array(z.string().min(1)).max(50).optional().default([])
	})
	.strict();

export const POST: RequestHandler = async ({ request, params }) => {
	const session = await requireApiSession(request);
	const teamId = params.teamId;
	if (!teamId) throw error(400, 'Missing team id');

	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}
	const parsed = bodySchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.message);

	const inviteEmails = parsed.data.inviteEmails.map((e) => String(e).trim()).filter(Boolean);

	try {
		const out = await inviteEmailsToExistingTeam({
			teamId,
			actorUserId: session.user.id,
			actorEmail: session.user.email,
			inviteEmails
		});
		return json({ ok: true, ...out });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Invite failed';
		if (msg === 'Forbidden') throw error(403, msg);
		if (msg === 'Team not found') throw error(404, msg);
		console.error('[api/teams/[teamId]/invites POST]', e);
		throw error(500, msg);
	}
};
