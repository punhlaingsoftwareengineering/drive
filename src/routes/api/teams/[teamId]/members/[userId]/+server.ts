import { requireApiSession } from '$lib/server/require-api-session';
import { assertTeamKeyHas, assertTeamRouteAccess } from '$lib/server/team-api-key-scope';
import { removeTeamMember, resolveTeamRouteId, updateTeamMemberRole } from '$lib/server/team-manage';
import { requireTeamMember } from '$lib/server/team-access';
import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const patchSchema = z
	.object({
		role: z.enum(['admin', 'member'])
	})
	.strict();

export const PATCH: RequestHandler = async ({ request, params }) => {
	const session = await requireApiSession(request);
	if (!params.teamId || !params.userId) throw error(400, 'Missing team or user id');

	const teamId = await resolveTeamRouteId(params.teamId);
	if (!teamId) throw error(404, 'Team not found');
	assertTeamRouteAccess(session, teamId);
	assertTeamKeyHas(session, 'members.manage');

	await requireTeamMember(session.user.id, teamId);

	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}
	const parsed = patchSchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.message);

	try {
		await updateTeamMemberRole(teamId, session.user.id, params.userId, parsed.data.role);
		return json({ ok: true });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Update failed';
		if (msg === 'Forbidden') throw error(403, msg);
		if (msg === 'Member not found') throw error(404, msg);
		if (msg.includes('owner') || msg.includes('role')) throw error(400, msg);
		console.error('[api/teams/[teamId]/members/[userId] PATCH]', e);
		throw error(500, msg);
	}
};

export const DELETE: RequestHandler = async ({ request, params }) => {
	const session = await requireApiSession(request);
	if (!params.teamId || !params.userId) throw error(400, 'Missing team or user id');

	const teamId = await resolveTeamRouteId(params.teamId);
	if (!teamId) throw error(404, 'Team not found');
	assertTeamRouteAccess(session, teamId);
	assertTeamKeyHas(session, 'members.manage');

	await requireTeamMember(session.user.id, teamId);

	try {
		await removeTeamMember(teamId, session.user.id, params.userId);
		return json({ ok: true });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Remove failed';
		if (msg === 'Forbidden') throw error(403, msg);
		if (msg === 'Member not found') throw error(404, msg);
		if (msg.includes('owner') || msg.includes('admin')) throw error(400, msg);
		console.error('[api/teams/[teamId]/members/[userId] DELETE]', e);
		throw error(500, msg);
	}
};
