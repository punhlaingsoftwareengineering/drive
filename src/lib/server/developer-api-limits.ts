import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { MainFileSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { TeamSchema } from '$lib/server/db/schema/main-schema/team.schema';
import { DeveloperApiKeySchema } from '$lib/server/db/schema/developer-schema/developer.schema';
import type { DriveApiSession } from '$lib/server/require-api-session';
import { error } from '@sveltejs/kit';
import { and, count, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

export type DeveloperApiLimitKey = 'teams' | 'folders' | 'files' | 'apiKeys';

export type DeveloperApiKeyLimits = {
	maxTeams: number | null;
	maxFolders: number | null;
	maxFiles: number | null;
};

export type DeveloperApiKeyLimitsInput = {
	teams?: number | null;
	folders?: number | null;
	files?: number | null;
};

const optionalLimit = z
	.union([z.number().int().min(0), z.null()])
	.optional()
	.transform((v) => (v === undefined ? undefined : v === null ? null : v));

export const developerApiKeyLimitsInputSchema = z
	.object({
		teams: optionalLimit,
		folders: optionalLimit,
		files: optionalLimit
	})
	.strict();

/** Optional `limits` object on API key create. */
export const developerApiKeyLimitsBodySchema = developerApiKeyLimitsInputSchema.optional();

export function normalizeDeveloperApiKeyLimits(
	input: DeveloperApiKeyLimitsInput | undefined
): DeveloperApiKeyLimits {
	return {
		maxTeams: input?.teams ?? null,
		maxFolders: input?.folders ?? null,
		maxFiles: input?.files ?? null
	};
}

export function serializeDeveloperApiKeyLimits(limits: DeveloperApiKeyLimits) {
	return {
		teams: limits.maxTeams,
		folders: limits.maxFolders,
		files: limits.maxFiles
	};
}

const ENV_BY_LIMIT: Record<DeveloperApiLimitKey, string> = {
	teams: 'DEVELOPER_API_MAX_TEAMS',
	folders: 'DEVELOPER_API_MAX_FOLDERS',
	files: 'DEVELOPER_API_MAX_FILES',
	apiKeys: 'DEVELOPER_API_MAX_API_KEYS'
};

const KEY_LIMIT_FIELD: Record<
	Exclude<DeveloperApiLimitKey, 'apiKeys'>,
	keyof DeveloperApiKeyLimits
> = {
	teams: 'maxTeams',
	folders: 'maxFolders',
	files: 'maxFiles'
};

function readLimitEnv(key: DeveloperApiLimitKey): number | null {
	const envKey = ENV_BY_LIMIT[key];
	const raw =
		(typeof (env as Record<string, string | undefined>)[envKey] === 'string' &&
		(env as Record<string, string | undefined>)[envKey]!.trim()
			? (env as Record<string, string | undefined>)[envKey]!.trim()
			: undefined) ??
		(typeof process.env[envKey] === 'string' && process.env[envKey]!.trim()
			? process.env[envKey]!.trim()
			: undefined);
	if (!raw || raw === '0') return null;
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 0) return null;
	return Math.floor(n);
}

/** `null` = no cap for that resource. */
export function developerApiLimit(key: DeveloperApiLimitKey): number | null {
	return readLimitEnv(key);
}

export function developerApiLimitsConfig(): Record<DeveloperApiLimitKey, number | null> {
	return {
		teams: developerApiLimit('teams'),
		folders: developerApiLimit('folders'),
		files: developerApiLimit('files'),
		apiKeys: developerApiLimit('apiKeys')
	};
}

async function countTeamsCreatedByUser(userId: string): Promise<number> {
	const [row] = await db
		.select({ n: count() })
		.from(TeamSchema)
		.where(eq(TeamSchema.createdByUserId, userId));
	return Number(row?.n ?? 0);
}

async function countTeamsCreatedByApiKey(apiKeyId: string): Promise<number> {
	const [row] = await db
		.select({ n: count() })
		.from(TeamSchema)
		.where(eq(TeamSchema.createdByApiKeyId, apiKeyId));
	return Number(row?.n ?? 0);
}

async function countOwnedItems(
	userId: string,
	itemType: 'folder' | 'file'
): Promise<number> {
	const [row] = await db
		.select({ n: count() })
		.from(MainFileSchema)
		.where(
			and(
				eq(MainFileSchema.ownerId, userId),
				eq(MainFileSchema.itemType, itemType),
				isNull(MainFileSchema.trashedAt)
			)
		);
	return Number(row?.n ?? 0);
}

async function countItemsCreatedByApiKey(
	apiKeyId: string,
	itemType: 'folder' | 'file'
): Promise<number> {
	const [row] = await db
		.select({ n: count() })
		.from(MainFileSchema)
		.where(
			and(
				eq(MainFileSchema.createdByApiKeyId, apiKeyId),
				eq(MainFileSchema.itemType, itemType),
				isNull(MainFileSchema.trashedAt)
			)
		);
	return Number(row?.n ?? 0);
}

export async function countActiveDeveloperApiKeys(userId: string): Promise<number> {
	const [row] = await db
		.select({ n: count() })
		.from(DeveloperApiKeySchema)
		.where(
			and(eq(DeveloperApiKeySchema.userId, userId), eq(DeveloperApiKeySchema.isRevoked, false))
		);
	return Number(row?.n ?? 0);
}

function limitMessage(resource: DeveloperApiLimitKey, max: number, scope: 'key' | 'account'): string {
	const labels: Record<DeveloperApiLimitKey, string> = {
		teams: 'teams',
		folders: 'folders',
		files: 'files',
		apiKeys: 'API keys'
	};
	const scopeLabel = scope === 'key' ? 'this API key' : 'your account';
	return `Developer API ${labels[resource]} limit for ${scopeLabel} reached (max ${max})`;
}

function keyLimitFor(
	resource: Exclude<DeveloperApiLimitKey, 'apiKeys'>,
	limits: DeveloperApiKeyLimits | undefined
): number | null {
	if (!limits) return null;
	return limits[KEY_LIMIT_FIELD[resource]];
}

/**
 * Enforce per-user (env) and per-key quotas for developer API key requests.
 * Browser cookie sessions are not capped.
 */
export async function assertDeveloperApiCanCreate(
	session: DriveApiSession,
	resource: Exclude<DeveloperApiLimitKey, 'apiKeys'>
): Promise<void> {
	if (!session.viaApiKey) return;

	// Team keys cannot create teams.
	if (resource === 'teams' && session.apiKeyTeamId) {
		throw error(403, 'Team API key cannot create teams');
	}

	const envMax = developerApiLimit(resource);
	if (envMax !== null) {
		const userCount =
			resource === 'teams'
				? await countTeamsCreatedByUser(session.user.id)
				: await countOwnedItems(session.user.id, resource === 'folders' ? 'folder' : 'file');
		if (userCount >= envMax) {
			throw error(403, limitMessage(resource, envMax, 'account'));
		}
	}

	const keyMax = keyLimitFor(resource, session.apiKeyLimits);
	if (keyMax !== null && session.apiKeyId) {
		const keyCount =
			resource === 'teams'
				? await countTeamsCreatedByApiKey(session.apiKeyId)
				: await countItemsCreatedByApiKey(
						session.apiKeyId,
						resource === 'folders' ? 'folder' : 'file'
					);
		if (keyCount >= keyMax) {
			throw error(403, limitMessage(resource, keyMax, 'key'));
		}
	}
}

/** Cap active API keys per user (applies when creating keys in Profile). */
export async function assertDeveloperApiKeyLimit(userId: string): Promise<void> {
	const max = developerApiLimit('apiKeys');
	if (max === null) return;
	const n = await countActiveDeveloperApiKeys(userId);
	if (n >= max) {
		throw error(403, limitMessage('apiKeys', max, 'account'));
	}
}
