import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import {
	getDeveloperModeEnabled,
	setDeveloperModeEnabled
} from '$lib/server/auth-user-lookup';
import { authDb } from '$lib/server/db/auth-db';
import { AuthUserSchema } from '$lib/server/db/schema/auth-schema/auth.schema';
import { DeveloperApiKeySchema } from '$lib/server/db/schema/developer-schema/developer.schema';
import type { DeveloperApiKeyLimits } from '$lib/server/developer-api-limits';
import {
	parseTeamApiKeyPermissions,
	type TeamApiKeyPermission,
	validateTeamApiKeyPermissionsForRole
} from '$lib/model/team-api-key-permission';
import type { TeamRole } from '$lib/model/team-role';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type ApiKeyKind = 'user' | 'team';

const USER_KEY_REGEX = /^znldv_([a-zA-Z0-9]{12})_(.+)$/;
const TEAM_KEY_REGEX = /^znltv_([a-zA-Z0-9]{12})_(.+)$/;

function apiKeyPepper(): string {
	return env.BETTER_AUTH_SECRET ?? 'znl-drive-dev-api-key-pepper';
}

export function hashDeveloperApiKeySecret(prefix: string, secret: string): string {
	return createHmac('sha256', apiKeyPepper())
		.update(prefix)
		.update('\0')
		.update(secret)
		.digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
	try {
		const ba = Buffer.from(a, 'hex');
		const bb = Buffer.from(b, 'hex');
		if (ba.length !== bb.length) return false;
		return timingSafeEqual(ba, bb);
	} catch {
		return false;
	}
}

export function parseDeveloperApiKeyFromRequest(request: Request): {
	raw: string;
	kind: ApiKeyKind;
} | null {
	const read = (t: string | null): { raw: string; kind: ApiKeyKind } | null => {
		if (!t) return null;
		const trimmed = t.trim();
		if (trimmed.startsWith('znldv_')) return { raw: trimmed, kind: 'user' };
		if (trimmed.startsWith('znltv_')) return { raw: trimmed, kind: 'team' };
		return null;
	};

	const auth = request.headers.get('authorization');
	if (auth?.toLowerCase().startsWith('bearer ')) {
		const hit = read(auth.slice(7).trim());
		if (hit) return hit;
	}
	return read(request.headers.get('x-api-key'));
}

export function maskedApiKey(kind: ApiKeyKind, keyPrefix: string, last4: string): string {
	const tag = kind === 'team' ? 'znltv' : 'znldv';
	return `${tag}_${keyPrefix}…${last4}`;
}

export type DeveloperApiUser = {
	id: string;
	email: string | null;
	name: string | null;
	apiKeyId: string;
	kind: ApiKeyKind;
	teamId: string | null;
	permissions: TeamApiKeyPermission[];
	limits: DeveloperApiKeyLimits;
};

export async function tryResolveUserFromDeveloperApiKey(
	request: Request
): Promise<DeveloperApiUser | null> {
	const parsed = parseDeveloperApiKeyFromRequest(request);
	if (!parsed) return null;

	const m = parsed.raw.match(parsed.kind === 'team' ? TEAM_KEY_REGEX : USER_KEY_REGEX);
	if (!m) return null;
	const prefix = m[1];
	const secret = m[2];

	const [row] = await db
		.select({
			keyId: DeveloperApiKeySchema.id,
			keyHash: DeveloperApiKeySchema.keyHash,
			userId: DeveloperApiKeySchema.userId,
			teamId: DeveloperApiKeySchema.teamId,
			permissions: DeveloperApiKeySchema.permissions,
			maxTeams: DeveloperApiKeySchema.maxTeams,
			maxFolders: DeveloperApiKeySchema.maxFolders,
			maxFiles: DeveloperApiKeySchema.maxFiles
		})
		.from(DeveloperApiKeySchema)
		.where(
			and(eq(DeveloperApiKeySchema.keyPrefix, prefix), eq(DeveloperApiKeySchema.isRevoked, false))
		)
		.limit(1);

	if (!row) return null;

	const isTeamKey = row.teamId !== null;
	if (parsed.kind === 'team' && !isTeamKey) return null;
	if (parsed.kind === 'user' && isTeamKey) return null;

	const [userRow] = await authDb
		.select({
			email: AuthUserSchema.email,
			name: AuthUserSchema.name,
			devMode: AuthUserSchema.developerModeEnabled
		})
		.from(AuthUserSchema)
		.where(eq(AuthUserSchema.id, row.userId))
		.limit(1);

	if (!userRow?.devMode) return null;

	const digest = hashDeveloperApiKeySecret(prefix, secret);
	if (!safeEqualHex(row.keyHash, digest)) return null;

	await db
		.update(DeveloperApiKeySchema)
		.set({ lastUsedAt: new Date() })
		.where(eq(DeveloperApiKeySchema.id, row.keyId));

	return {
		id: row.userId,
		email: userRow.email,
		name: userRow.name,
		apiKeyId: row.keyId,
		kind: isTeamKey ? 'team' : 'user',
		teamId: row.teamId,
		permissions: parseTeamApiKeyPermissions(row.permissions),
		limits: {
			maxTeams: row.maxTeams,
			maxFolders: row.maxFolders,
			maxFiles: row.maxFiles
		}
	};
}

function randomPrefix12(): string {
	let s = '';
	while (s.length < 12) {
		s += randomBytes(9)
			.toString('base64url')
			.replace(/[^a-zA-Z0-9]/g, '');
	}
	return s.slice(0, 12);
}

async function insertApiKeyRow(values: {
	userId: string;
	name: string;
	teamId: string | null;
	permissions: TeamApiKeyPermission[];
	limits: DeveloperApiKeyLimits;
	kind: ApiKeyKind;
}): Promise<{
	id: string;
	plaintextKey: string;
	keyPrefix: string;
	last4: string;
	name: string;
	limits: DeveloperApiKeyLimits;
	permissions: TeamApiKeyPermission[];
}> {
	const tag = values.kind === 'team' ? 'znltv' : 'znldv';
	let lastErr: unknown;
	for (let attempt = 0; attempt < 5; attempt++) {
		const prefix = randomPrefix12();
		const secret = randomBytes(32).toString('base64url');
		const fullKey = `${tag}_${prefix}_${secret}`;
		const keyHash = hashDeveloperApiKeySecret(prefix, secret);
		const last4 = secret.slice(-4);
		try {
			const [inserted] = await db
				.insert(DeveloperApiKeySchema)
				.values({
					userId: values.userId,
					name: values.name,
					keyPrefix: prefix,
					keyHash,
					last4,
					teamId: values.teamId,
					permissions: values.permissions,
					maxTeams: values.limits.maxTeams,
					maxFolders: values.limits.maxFolders,
					maxFiles: values.limits.maxFiles
				})
				.returning({ id: DeveloperApiKeySchema.id });
			return {
				id: inserted.id,
				plaintextKey: fullKey,
				keyPrefix: prefix,
				last4,
				name: values.name,
				limits: values.limits,
				permissions: values.permissions
			};
		} catch (e) {
			lastErr = e;
			if (attempt < 4) continue;
		}
	}
	throw lastErr instanceof Error ? lastErr : new Error('Failed to create API key');
}

export async function createDeveloperApiKey(
	userId: string,
	displayName: string,
	limits?: DeveloperApiKeyLimits
) {
	const name = displayName.trim();
	if (!name) throw new Error('App name is required');
	const limitValues = limits ?? { maxTeams: null, maxFolders: null, maxFiles: null };
	return insertApiKeyRow({
		userId,
		name,
		teamId: null,
		permissions: [],
		limits: limitValues,
		kind: 'user'
	});
}

export async function createTeamApiKey(params: {
	userId: string;
	teamId: string;
	displayName: string;
	permissions: TeamApiKeyPermission[];
	limits?: DeveloperApiKeyLimits;
	creatorRole: TeamRole;
}) {
	const name = params.displayName.trim();
	if (!name) throw new Error('App name is required');
	validateTeamApiKeyPermissionsForRole(params.permissions, params.creatorRole);
	const limitValues = {
		maxTeams: null,
		maxFolders: params.limits?.maxFolders ?? null,
		maxFiles: params.limits?.maxFiles ?? null
	};
	return insertApiKeyRow({
		userId: params.userId,
		name,
		teamId: params.teamId,
		permissions: params.permissions,
		limits: limitValues,
		kind: 'team'
	});
}

export async function listDeveloperApiKeysForUser(userId: string) {
	return db
		.select({
			id: DeveloperApiKeySchema.id,
			name: DeveloperApiKeySchema.name,
			keyPrefix: DeveloperApiKeySchema.keyPrefix,
			last4: DeveloperApiKeySchema.last4,
			createdAt: DeveloperApiKeySchema.createdAt,
			lastUsedAt: DeveloperApiKeySchema.lastUsedAt,
			isRevoked: DeveloperApiKeySchema.isRevoked,
			maxTeams: DeveloperApiKeySchema.maxTeams,
			maxFolders: DeveloperApiKeySchema.maxFolders,
			maxFiles: DeveloperApiKeySchema.maxFiles,
			teamId: DeveloperApiKeySchema.teamId,
			permissions: DeveloperApiKeySchema.permissions
		})
		.from(DeveloperApiKeySchema)
		.where(and(eq(DeveloperApiKeySchema.userId, userId), isNull(DeveloperApiKeySchema.teamId)))
		.orderBy(desc(DeveloperApiKeySchema.createdAt));
}

export async function listTeamApiKeys(teamId: string) {
	return db
		.select({
			id: DeveloperApiKeySchema.id,
			name: DeveloperApiKeySchema.name,
			keyPrefix: DeveloperApiKeySchema.keyPrefix,
			last4: DeveloperApiKeySchema.last4,
			createdAt: DeveloperApiKeySchema.createdAt,
			lastUsedAt: DeveloperApiKeySchema.lastUsedAt,
			isRevoked: DeveloperApiKeySchema.isRevoked,
			maxFolders: DeveloperApiKeySchema.maxFolders,
			maxFiles: DeveloperApiKeySchema.maxFiles,
			permissions: DeveloperApiKeySchema.permissions,
			userId: DeveloperApiKeySchema.userId
		})
		.from(DeveloperApiKeySchema)
		.where(and(eq(DeveloperApiKeySchema.teamId, teamId), eq(DeveloperApiKeySchema.isRevoked, false)))
		.orderBy(desc(DeveloperApiKeySchema.createdAt));
}

export async function updateDeveloperApiKeyLimits(
	userId: string,
	keyId: string,
	limits: DeveloperApiKeyLimits
): Promise<boolean> {
	const res = await db
		.update(DeveloperApiKeySchema)
		.set({
			maxTeams: limits.maxTeams,
			maxFolders: limits.maxFolders,
			maxFiles: limits.maxFiles
		})
		.where(
			and(
				eq(DeveloperApiKeySchema.id, keyId),
				eq(DeveloperApiKeySchema.userId, userId),
				isNull(DeveloperApiKeySchema.teamId),
				eq(DeveloperApiKeySchema.isRevoked, false)
			)
		)
		.returning({ id: DeveloperApiKeySchema.id });
	return res.length > 0;
}

export async function updateTeamApiKey(
	teamId: string,
	keyId: string,
	updates: {
		limits: DeveloperApiKeyLimits;
		permissions: TeamApiKeyPermission[];
		creatorRole: TeamRole;
	}
): Promise<boolean> {
	validateTeamApiKeyPermissionsForRole(updates.permissions, updates.creatorRole);
	const res = await db
		.update(DeveloperApiKeySchema)
		.set({
			maxFolders: updates.limits.maxFolders,
			maxFiles: updates.limits.maxFiles,
			permissions: updates.permissions
		})
		.where(
			and(
				eq(DeveloperApiKeySchema.id, keyId),
				eq(DeveloperApiKeySchema.teamId, teamId),
				eq(DeveloperApiKeySchema.isRevoked, false)
			)
		)
		.returning({ id: DeveloperApiKeySchema.id });
	return res.length > 0;
}

export async function revokeDeveloperApiKey(userId: string, keyId: string): Promise<boolean> {
	const now = new Date();
	const res = await db
		.update(DeveloperApiKeySchema)
		.set({ isRevoked: true, revokedAt: now })
		.where(
			and(
				eq(DeveloperApiKeySchema.id, keyId),
				eq(DeveloperApiKeySchema.userId, userId),
				isNull(DeveloperApiKeySchema.teamId),
				eq(DeveloperApiKeySchema.isRevoked, false)
			)
		)
		.returning({ id: DeveloperApiKeySchema.id });
	return res.length > 0;
}

export async function revokeTeamApiKey(teamId: string, keyId: string): Promise<boolean> {
	const now = new Date();
	const res = await db
		.update(DeveloperApiKeySchema)
		.set({ isRevoked: true, revokedAt: now })
		.where(
			and(
				eq(DeveloperApiKeySchema.id, keyId),
				eq(DeveloperApiKeySchema.teamId, teamId),
				eq(DeveloperApiKeySchema.isRevoked, false)
			)
		)
		.returning({ id: DeveloperApiKeySchema.id });
	return res.length > 0;
}

export { getDeveloperModeEnabled, setDeveloperModeEnabled };
