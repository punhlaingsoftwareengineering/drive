import {
	createDeveloperApiKey,
	getDeveloperModeEnabled,
	listDeveloperApiKeysForUser
} from '$lib/server/developer-api-key';
import {
	assertDeveloperApiKeyLimit,
	developerApiKeyLimitsBodySchema,
	normalizeDeveloperApiKeyLimits,
	serializeDeveloperApiKeyLimits
} from '$lib/server/developer-api-limits';
import { requireCookieApiSession } from '$lib/server/require-api-session';
import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const createBodySchema = z
	.object({
		name: z.string().min(1).max(120),
		limits: developerApiKeyLimitsBodySchema
	})
	.strict();

export const GET: RequestHandler = async ({ request }) => {
	const session = await requireCookieApiSession(request);
	if (!(await getDeveloperModeEnabled(session.user.id))) {
		return json({ keys: [] as const, developerModeRequired: true });
	}
	const rows = await listDeveloperApiKeysForUser(session.user.id);
	return json({
		keys: rows.map((k) => ({
			id: k.id,
			name: k.name,
			masked: `znldv_${k.keyPrefix}…${k.last4}`,
			createdAt: k.createdAt?.toISOString() ?? null,
			lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
			isRevoked: k.isRevoked,
			limits: serializeDeveloperApiKeyLimits({
				maxTeams: k.maxTeams,
				maxFolders: k.maxFolders,
				maxFiles: k.maxFiles
			})
		}))
	});
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await requireCookieApiSession(request);
	if (!(await getDeveloperModeEnabled(session.user.id))) {
		throw error(403, 'Enable developer mode first');
	}
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}
	const parsed = createBodySchema.safeParse(body);
	if (!parsed.success) throw error(400, parsed.error.message);

	await assertDeveloperApiKeyLimit(session.user.id);

	const limits = normalizeDeveloperApiKeyLimits(parsed.data.limits);

	try {
		const created = await createDeveloperApiKey(session.user.id, parsed.data.name, limits);
		return json({
			ok: true,
			id: created.id,
			name: created.name,
			key: created.plaintextKey,
			masked: `znldv_${created.keyPrefix}…${created.last4}`,
			limits: serializeDeveloperApiKeyLimits(created.limits),
			warning: 'Copy this key now. You will not see it again.'
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Failed to create key';
		throw error(500, msg);
	}
};
