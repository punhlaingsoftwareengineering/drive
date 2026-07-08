import { env } from '$env/dynamic/private';
import { getConfiguredOrigin } from '$lib/server/public-origin';

/** Employee portal public origin for SSO redirects (e.g. `https://phh.com`). */
export function getPortalOrigin(): string | undefined {
	const raw =
		(typeof env.PORTAL_ORIGIN === 'string' && env.PORTAL_ORIGIN.trim()
			? env.PORTAL_ORIGIN.trim()
			: undefined) ??
		(typeof process.env.PORTAL_ORIGIN === 'string' && process.env.PORTAL_ORIGIN.trim()
			? process.env.PORTAL_ORIGIN.trim()
			: undefined);
	return raw?.replace(/\/$/, '');
}

/** Portal login URL with optional return to current drive URL. */
export function portalLoginUrl(returnTo?: string): string {
	const portal = getPortalOrigin();
	if (!portal) return '/auth/login';

	const driveOrigin = getConfiguredOrigin();
	const target =
		returnTo ??
		(driveOrigin ? `${driveOrigin}/home` : undefined) ??
		'http://localhost:1025/home';

	const url = new URL('/auth/login', portal);
	url.searchParams.set('redirectTo', target);
	return url.toString();
}
