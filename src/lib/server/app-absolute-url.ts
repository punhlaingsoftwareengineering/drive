import { env } from '$env/dynamic/private';

function normalizeBasePath(): string {
	const rawBase = import.meta.env.BASE_URL ?? '/';
	return rawBase.endsWith('/') && rawBase.length > 1
		? rawBase.slice(0, -1)
		: rawBase === '/'
			? ''
			: rawBase;
}

/**
 * Full URL including origin and Vite `BASE_URL` (SvelteKit `paths.base`).
 * Do not use `$app/paths` `resolve()` here: from deep server modules it can return a
 * relative path (`../../../../...`), which produces broken strings like
 * `http://localhost:1025../../../../api/...`.
 *
 * In **production** builds, when **`ORIGIN`** is set (recommended for Fly.io), it is used instead of
 * `requestUrl`’s origin so copied share links and image URLs match the public site URL. Dev and tests
 * always use the request URL so local setups behave predictably.
 */
export function appAbsoluteUrlFromRequest(requestUrl: string, pathname: string): string {
	const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
	const base = normalizeBasePath();
	const configured =
		import.meta.env.PROD && typeof env.ORIGIN === 'string' && env.ORIGIN.trim()
			? env.ORIGIN.trim().replace(/\/$/, '')
			: '';
	const origin = configured || new URL(requestUrl).origin;
	return `${origin}${base}${path}`;
}
