import { sequence } from '@sveltejs/kit/hooks';
import { building, dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { auth } from '$lib/server/auth';
import { isAuthPath } from 'better-auth/svelte-kit';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';

let warnedMissingOrigin = false;

/** Logs once if ORIGIN is unset in production (breaks Better Auth baseURL + SvelteKit form POST CSRF checks). */
const handleProductionConfig: Handle = ({ event, resolve }) => {
	if (!building && !dev && !warnedMissingOrigin) {
		const o = typeof env.ORIGIN === 'string' ? env.ORIGIN.trim() : '';
		if (!o) {
			warnedMissingOrigin = true;
			console.error(
				'[config] ORIGIN is empty. Set it to your public URL (e.g. fly secrets set ORIGIN=https://your-app.fly.dev). ' +
					'Otherwise logins can fail with "Cross-site POST form submissions are forbidden".'
			);
		}
	}
	return resolve(event);
};

/** Browsers often request `/favicon.ico` even when HTML points at `/favicon.svg`. */
const handleFavicon: Handle = ({ event, resolve }) => {
	if (event.url.pathname === '/favicon.ico') {
		return Response.redirect(new URL('/favicon.svg', event.url), 302);
	}
	return resolve(event);
};

/**
 * SvelteKit routes under `/api/auth/*` that must hit +server.ts instead of Better Auth’s catch-all handler.
 * Better Auth’s `svelteKitHandler` forwards every `/api/auth` request to `auth.handler`, which 404s unknown paths.
 */
const CUSTOM_API_AUTH_PATH_PREFIXES = [
	'/api/auth/login',
	'/api/auth/logout',
	'/api/auth/signup',
	'/api/auth/send-otp',
	'/api/auth/social'
] as const;

function isCustomApiAuthPath(pathname: string): boolean {
	return CUSTOM_API_AUTH_PATH_PREFIXES.some(
		(base) => pathname === base || pathname.startsWith(`${base}/`)
	);
}

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
		});
	});

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	try {
		const session = await auth.api.getSession({ headers: event.request.headers });

		if (session) {
			event.locals.session = session.session;
			event.locals.user = session.user;
		}
	} catch (e) {
		console.error('[hooks] getSession failed (database or auth unavailable)', e);
		event.locals.authUnavailable = true;
	}

	if (building) {
		return resolve(event);
	}

	if (isCustomApiAuthPath(event.url.pathname)) {
		return resolve(event);
	}

	if (isAuthPath(event.url.toString(), auth.options)) {
		return auth.handler(event.request);
	}

	return resolve(event);
};

export const handle: Handle = sequence(
	handleProductionConfig,
	handleFavicon,
	handleParaglide,
	handleBetterAuth
);

export const handleError: HandleServerError = ({ error, event, status, message }) => {
	const path = event.url.pathname;
	const err = error instanceof Error ? error : null;
	if (import.meta.env.DEV) {
		console.error('[handleError]', status, path, err ?? message);
	} else {
		console.error('[handleError]', status, path, err?.message ?? message);
	}
	const safe =
		status === 404
			? typeof message === 'string' && message
				? message
				: 'This page could not be found.'
			: status === 503
				? 'Service temporarily unavailable. Please try again in a moment.'
				: 'Something went wrong. Please try again.';
	return {
		message: import.meta.env.DEV && err?.message ? err.message : safe
	};
};
