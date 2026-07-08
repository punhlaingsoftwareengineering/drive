import { requireApiSession } from '$lib/server/require-api-session';
import { assertTeamKeyHas, assertTeamRouteAccess } from '$lib/server/team-api-key-scope';
import {
	getTeamMemberRole,
	listTeamMembersAndInvites,
	resolveTeamRouteId
} from '$lib/server/team-manage';
import { isTeamAdminRole } from '$lib/model/team-role';
import { requireTeamMember } from '$lib/server/team-access';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params }) => {
	const session = await requireApiSession(request);
	if (!params.teamId) throw error(400, 'Missing team id');

	const teamId = await resolveTeamRouteId(params.teamId);
	if (!teamId) throw error(404, 'Team not found');
	assertTeamRouteAccess(session, teamId);
	assertTeamKeyHas(session, 'members.read');

	await requireTeamMember(session.user.id, teamId);

	const { members, pendingInvites } = await listTeamMembersAndInvites(teamId);
	const actorRole = await getTeamMemberRole(session.user.id, teamId);

	return json({
		ok: true,
		members,
		pendingInvites,
		actorRole,
		isOwner: actorRole === 'owner',
		isAdmin: actorRole ? isTeamAdminRole(actorRole) : false
	});
};
