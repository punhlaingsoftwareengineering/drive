import { env } from '$env/dynamic/private';

/** Public site URL from `ORIGIN` (no trailing slash). */
export function getConfiguredOrigin(): string | undefined {
	const fromEnv =
		(typeof env.ORIGIN === 'string' && env.ORIGIN.trim() ? env.ORIGIN.trim() : undefined) ??
		(typeof process.env.ORIGIN === 'string' && process.env.ORIGIN.trim()
			? process.env.ORIGIN.trim()
			: undefined);
	return fromEnv?.replace(/\/$/, '');
}

/** `Secure` cookies only when users reach the app over HTTPS. HTTP LAN deploys must not set Secure. */
export function useSecureCookies(): boolean {
	const origin = getConfiguredOrigin();
	return origin?.startsWith('https://') ?? false;
}
