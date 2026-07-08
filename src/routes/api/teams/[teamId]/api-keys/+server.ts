import {
	createTeamApiKey,
	getDeveloperModeEnabled,
	listTeamApiKeys,
	maskedApiKey,
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

const createBodySchema = z
	.object({
		name: z.string().min(1).max(120),
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

export const GET: RequestHandler = async ({ request, params }) => {
	const session = await requireCookieApiSession(request);
	if (!params.teamId) throw error(400, 'Missing team id');
	const teamId = await resolveTeamId(params.teamId);
	await requireTeamMember(session.user.id, teamId);

	if (!(await getDeveloperModeEnabled(session.user.id))) {
		return json({ keys: [] as const, developerModeRequired: true });
	}

	const rows = await listTeamApiKeys(teamId);
	return json({
		keys: rows.map((k) => ({
			id: k.id,
			name: k.name,
			masked: maskedApiKey('team', k.keyPrefix, k.last4),
			createdAt: k.createdAt?.toISOString() ?? null,
			lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
			isRevoked: k.isRevoked,
			permissions: parseTeamApiKeyPermissions(k.permissions),
			limits: serializeDeveloperApiKeyLimits({
				maxTeams: null,
				maxFolders: k.maxFolders,
				maxFiles: k.maxFiles
			})
		}))
	});
};

export const POST: RequestHandler = async ({ request, params }) => {
	const session = await requireCookieApiSession(request);
	if (!params.teamId) throw error(400, 'Missing team id');
	const teamId = await resolveTeamId(params.teamId);
	const role = await requireTeamAdminWithDevMode(session.user.id, teamId);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}
	const parsed = createBodySchema.safeParse(body);
	if (!parsed.success) throw error(400, parsed.error.message);

	const limits = normalizeDeveloperApiKeyLimits(parsed.data.limits);
	limits.maxTeams = null;

	try {
		const created = await createTeamApiKey({
			userId: session.user.id,
			teamId,
			displayName: parsed.data.name,
			permissions: parsed.data.permissions,
			limits,
			creatorRole: role
		});
		return json({
			ok: true,
			id: created.id,
			name: created.name,
			key: created.plaintextKey,
			masked: maskedApiKey('team', created.keyPrefix, created.last4),
			permissions: created.permissions,
			limits: serializeDeveloperApiKeyLimits(created.limits),
			warning: 'Copy this key now. You will not see it again.'
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Failed to create key';
		if (msg.includes('Permission') || msg.includes('permission')) {
			throw error(400, msg);
		}
		throw error(500, msg);
	}
};
