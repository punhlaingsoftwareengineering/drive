import {
	getDeveloperModeEnabled,
	revokeDeveloperApiKey,
	updateDeveloperApiKeyLimits
} from '$lib/server/developer-api-key';
import {
	developerApiKeyLimitsInputSchema,
	developerApiKeyLimitsBodySchema,
	normalizeDeveloperApiKeyLimits,
	serializeDeveloperApiKeyLimits
} from '$lib/server/developer-api-limits';
import { requireCookieApiSession } from '$lib/server/require-api-session';
import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const patchBodySchema = z
	.object({
		limits: developerApiKeyLimitsInputSchema
	})
	.strict();

export const PATCH: RequestHandler = async ({ request, params }) => {
	const session = await requireCookieApiSession(request);
	if (!(await getDeveloperModeEnabled(session.user.id))) {
		throw error(403, 'Enable developer mode first');
	}
	const id = params.id;
	if (!id) throw error(400, 'Missing id');

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}
	const parsed = patchBodySchema.safeParse(body);
	if (!parsed.success) throw error(400, parsed.error.message);

	const limits = normalizeDeveloperApiKeyLimits(parsed.data.limits);
	const ok = await updateDeveloperApiKeyLimits(session.user.id, id, limits);
	if (!ok) throw error(404, 'Key not found');

	return json({ ok: true, limits: serializeDeveloperApiKeyLimits(limits) });
};

export const DELETE: RequestHandler = async ({ request, params }) => {
	const session = await requireCookieApiSession(request);
	if (!(await getDeveloperModeEnabled(session.user.id))) {
		throw error(403, 'Enable developer mode first');
	}
	const id = params.id;
	if (!id) throw error(400, 'Missing id');
	const ok = await revokeDeveloperApiKey(session.user.id, id);
	if (!ok) throw error(404, 'Key not found');
	return json({ ok: true });
};
