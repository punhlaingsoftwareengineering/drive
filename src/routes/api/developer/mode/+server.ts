import { getDeveloperModeEnabled, setDeveloperModeEnabled } from '$lib/server/developer-api-key';
import { developerApiLimitsConfig } from '$lib/server/developer-api-limits';
import { requireCookieApiSession } from '$lib/server/require-api-session';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const session = await requireCookieApiSession(request);
	const enabled = await getDeveloperModeEnabled(session.user.id);
	return json({ enabled, limits: developerApiLimitsConfig() });
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await requireCookieApiSession(request);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}
	if (
		!body ||
		typeof body !== 'object' ||
		!('enabled' in body) ||
		typeof (body as { enabled: unknown }).enabled !== 'boolean'
	) {
		throw error(400, 'Expected { enabled: boolean }');
	}
	const enabled = (body as { enabled: boolean }).enabled;
	await setDeveloperModeEnabled(session.user.id, enabled);
	return json({ ok: true, enabled });
};
