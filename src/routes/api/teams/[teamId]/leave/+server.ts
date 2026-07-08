import { requireApiSession } from '$lib/server/require-api-session';
import { leaveTeam, resolveTeamRouteId } from '$lib/server/team-manage';
import { requireTeamMember } from '$lib/server/team-access';
import { isTeamScopedApiKey } from '$lib/server/team-api-key-scope';
import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const bodySchema = z
	.object({
		newOwnerUserId: z.string().min(1).optional()
	})
	.strict();

export const POST: RequestHandler = async ({ request, params }) => {
	const session = await requireApiSession(request);
	if (isTeamScopedApiKey(session)) {
		throw error(403, 'Team API key cannot leave a team');
	}
	if (!params.teamId) throw error(400, 'Missing team id');

	const teamId = await resolveTeamRouteId(params.teamId);
	if (!teamId) throw error(404, 'Team not found');

	await requireTeamMember(session.user.id, teamId);

	let raw: unknown = {};
	try {
		const text = await request.text();
		if (text.trim()) raw = JSON.parse(text);
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const parsed = bodySchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.message);

	try {
		await leaveTeam(teamId, session.user.id, parsed.data.newOwnerUserId);
		return json({ ok: true });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Leave failed';
		if (msg === 'Forbidden') throw error(403, msg);
		if (msg.includes('owner') || msg.includes('admin')) throw error(400, msg);
		console.error('[api/teams/[teamId]/leave POST]', e);
		throw error(500, msg);
	}
};
