import { requireApiSession } from '$lib/server/require-api-session';
import { isTeamScopedApiKey } from '$lib/server/team-api-key-scope';
import { deleteTeamWithData, resolveTeamRouteId, updateTeamName } from '$lib/server/team-manage';
import { requireTeamMember } from '$lib/server/team-access';
import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const patchSchema = z
	.object({
		name: z.string().min(1).max(200)
	})
	.strict();

async function resolveTeamId(param: string): Promise<string> {
	const teamId = await resolveTeamRouteId(param);
	if (!teamId) throw error(404, 'Team not found');
	return teamId;
}

export const PATCH: RequestHandler = async ({ request, params }) => {
	const session = await requireApiSession(request);
	if (!params.teamId) throw error(400, 'Missing team id');
	const teamId = await resolveTeamId(params.teamId);
	assertTeamRouteAccess(session, teamId);
	await requireTeamMember(session.user.id, teamId);

	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}
	const parsed = patchSchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.message);

	assertTeamKeyHas(session, 'team.settings');

	try {
		const out = await updateTeamName(teamId, session.user.id, parsed.data.name);
		return json({ ok: true, ...out });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Update failed';
		if (msg === 'Forbidden') throw error(403, msg);
		if (msg === 'Team not found') throw error(404, msg);
		console.error('[api/teams/[teamId] PATCH]', e);
		throw error(500, msg);
	}
};

export const DELETE: RequestHandler = async ({ request, params }) => {
	const session = await requireApiSession(request);
	if (!params.teamId) throw error(400, 'Missing team id');
	const teamId = await resolveTeamId(params.teamId);
	assertTeamRouteAccess(session, teamId);
	await requireTeamMember(session.user.id, teamId);
	assertTeamKeyHas(session, 'team.delete');

	try {
		await deleteTeamWithData(teamId, session.user.id);
		return json({ ok: true });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Delete failed';
		if (msg === 'Forbidden') throw error(403, msg);
		if (msg === 'Team not found') throw error(404, msg);
		console.error('[api/teams/[teamId] DELETE]', e);
		throw error(500, msg);
	}
};
