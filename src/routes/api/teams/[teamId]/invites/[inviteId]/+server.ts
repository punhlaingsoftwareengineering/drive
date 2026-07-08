import { requireApiSession } from '$lib/server/require-api-session';
import { assertTeamKeyHas, assertTeamRouteAccess } from '$lib/server/team-api-key-scope';
import { cancelTeamInvite, resolveTeamRouteId } from '$lib/server/team-manage';
import { requireTeamMember } from '$lib/server/team-access';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ request, params }) => {
	const session = await requireApiSession(request);
	if (!params.teamId || !params.inviteId) throw error(400, 'Missing team or invite id');

	const teamId = await resolveTeamRouteId(params.teamId);
	if (!teamId) throw error(404, 'Team not found');
	assertTeamRouteAccess(session, teamId);
	assertTeamKeyHas(session, 'invites.manage');

	await requireTeamMember(session.user.id, teamId);

	try {
		await cancelTeamInvite(teamId, session.user.id, params.inviteId);
		return json({ ok: true });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Cancel failed';
		if (msg === 'Forbidden') throw error(403, msg);
		if (msg === 'Invite not found') throw error(404, msg);
		console.error('[api/teams/[teamId]/invites/[inviteId] DELETE]', e);
		throw error(500, msg);
	}
};
