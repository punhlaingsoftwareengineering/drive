import type { TeamApiKeyPermission } from '$lib/model/team-api-key-permission';
import { teamApiKeyHasPermission } from '$lib/model/team-api-key-permission';
import type { DriveApiSession } from '$lib/server/require-api-session';
import { error } from '@sveltejs/kit';
import { z } from 'zod';

export function isTeamScopedApiKey(session: DriveApiSession): boolean {
	return Boolean(session.viaApiKey && session.apiKeyTeamId);
}

/** Block team keys from personal-only routes (no team context). */
export function assertUserWideApiAccess(session: DriveApiSession): void {
	if (isTeamScopedApiKey(session)) {
		throw error(403, 'Team API key cannot access personal drive');
	}
}

/** Team keys may only access their bound team route. */
export function assertTeamRouteAccess(session: DriveApiSession, teamId: string): void {
	if (!session.apiKeyTeamId) return;
	if (session.apiKeyTeamId !== teamId) {
		throw error(403, 'Team API key is not allowed for this team');
	}
}

export function assertTeamKeyHas(
	session: DriveApiSession,
	permission: TeamApiKeyPermission
): void {
	if (!session.apiKeyTeamId) return;
	if (!teamApiKeyHasPermission(session.apiKeyPermissions, permission)) {
		throw error(403, `Team API key missing permission: ${permission}`);
	}
}

/**
 * Resolve `teamId` for drive APIs. Team keys default to their bound team when omitted.
 */
export function resolveEffectiveTeamId(session: DriveApiSession, url: URL): string | null {
	const raw = url.searchParams.get('teamId')?.trim() ?? '';
	if (session.apiKeyTeamId) {
		if (!raw) return session.apiKeyTeamId;
		const parsed = z.string().uuid().safeParse(raw);
		if (!parsed.success) throw error(400, 'Invalid team id');
		if (parsed.data !== session.apiKeyTeamId) {
			throw error(403, 'Team API key is not allowed for this team');
		}
		return parsed.data;
	}
	if (!raw) return null;
	const parsed = z.string().uuid().safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid team id');
	return parsed.data;
}

/** Team keys default to their bound team when `teamId` is omitted from body/query. */
export function resolveEffectiveTeamIdParam(
	session: DriveApiSession,
	teamIdParam?: string | null
): string | null {
	if (session.apiKeyTeamId) {
		if (!teamIdParam) return session.apiKeyTeamId;
		const parsed = z.string().uuid().safeParse(teamIdParam);
		if (!parsed.success) throw error(400, 'Invalid team id');
		if (parsed.data !== session.apiKeyTeamId) {
			throw error(403, 'Team API key is not allowed for this team');
		}
		return parsed.data;
	}
	if (!teamIdParam) return null;
	const parsed = z.string().uuid().safeParse(teamIdParam);
	if (!parsed.success) throw error(400, 'Invalid team id');
	return parsed.data;
}

export function assertTeamKeyCanAccessFileRow(
	session: DriveApiSession,
	row: { teamId: string | null }
): void {
	if (!session.apiKeyTeamId) return;
	if (row.teamId !== session.apiKeyTeamId) {
		throw error(403, 'Team API key cannot access this item');
	}
	if (!row.teamId) {
		throw error(403, 'Team API key cannot access personal drive items');
	}
}

/** Team keys cannot create new teams. */
export function assertTeamKeyCanCreateTeam(session: DriveApiSession): void {
	if (isTeamScopedApiKey(session)) {
		throw error(403, 'Team API key cannot create teams');
	}
}
