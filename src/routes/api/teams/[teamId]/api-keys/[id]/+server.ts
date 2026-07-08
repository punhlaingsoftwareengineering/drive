import {
	getDeveloperModeEnabled,
	revokeTeamApiKey,
	updateTeamApiKey
} from '$lib/server/developer-api-key';
import {
	developerApiKeyLimitsInputSchema,
	normalizeDeveloperApiKeyLimits,
	serializeDeveloperApiKeyLimits
} from '$lib/server/developer-api-limits';
import {
	parseTeamApiKeyPermissions,
	TEAM_API_KEY_PERMISSIONS
} from '$lib/model/team-api-key-permission';
import { requireCookieApiSession } from '$lib/server/require-api-session';
import { getTeamMemberRole, resolveTeamRouteId } from '$lib/server/team-manage';
import { isTeamAdminRole } from '$lib/model/team-role';
import { requireTeamMember } from '$lib/server/team-access';
import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const patchBodySchema = z
	.object({
		permissions: z.array(z.enum(TEAM_API_KEY_PERMISSIONS)).min(1),
		limits: developerApiKeyLimitsInputSchema
	})
	.strict();

async function resolveTeamId(param: string): Promise<string> {
	const teamId = await resolveTeamRouteId(param);
	if (!teamId) throw error(404, 'Team not found');
	return teamId;
}

async function requireTeamAdminWithDevMode(userId: string, teamId: string) {
	if (!(await getDeveloperModeEnabled(userId))) {
		throw error(403, 'Enable developer mode in Profile first');
	}
	await requireTeamMember(userId, teamId);
	const role = await getTeamMemberRole(userId, teamId);
	if (!role || !isTeamAdminRole(role)) {
		throw error(403, 'Forbidden');
	}
	return role;
}

export const PATCH: RequestHandler = async ({ request, params }) => {
	const session = await requireCookieApiSession(request);
	if (!params.teamId) throw error(400, 'Missing team id');
	if (!params.id) throw error(400, 'Missing id');
	const teamId = await resolveTeamId(params.teamId);
	const role = await requireTeamAdminWithDevMode(session.user.id, teamId);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}
	const parsed = patchBodySchema.safeParse(body);
	if (!parsed.success) throw error(400, parsed.error.message);

	const limits = normalizeDeveloperApiKeyLimits(parsed.data.limits);
	limits.maxTeams = null;

	try {
		const ok = await updateTeamApiKey(teamId, params.id, {
			limits,
			permissions: parsed.data.permissions,
			creatorRole: role
		});
		if (!ok) throw error(404, 'Key not found');
		return json({
			ok: true,
			permissions: parsed.data.permissions,
			limits: serializeDeveloperApiKeyLimits(limits)
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Update failed';
		if (msg.includes('Permission') || msg.includes('permission')) {
			throw error(400, msg);
		}
		throw error(500, msg);
	}
};

export const DELETE: RequestHandler = async ({ request, params }) => {
	const session = await requireCookieApiSession(request);
	if (!params.teamId) throw error(400, 'Missing team id');
	if (!params.id) throw error(400, 'Missing id');
	const teamId = await resolveTeamId(params.teamId);
	await requireTeamAdminWithDevMode(session.user.id, teamId);

	const ok = await revokeTeamApiKey(teamId, params.id);
	if (!ok) throw error(404, 'Key not found');
	return json({ ok: true });
};
