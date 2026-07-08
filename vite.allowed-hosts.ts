import { loadEnv } from 'vite';

/** Vite dev server host allowlist from .env (AUTH_COOKIE_DOMAIN / ORIGIN). */
export function viteAllowedHosts(env: Record<string, string>): string[] {
	const explicit = env.ALLOWED_HOSTS?.split(',')
		.map((value) => value.trim())
		.filter(Boolean);
	if (explicit?.length) return explicit;

	const cookieDomain = env.AUTH_COOKIE_DOMAIN?.trim();
	if (cookieDomain) {
		return [cookieDomain.startsWith('.') ? cookieDomain : `.${cookieDomain}`];
	}

	const hostnames = [env.ORIGIN, env.PORTAL_ORIGIN]
		.map((raw) => {
			if (!raw?.trim()) return null;
			try {
				return new URL(raw.trim()).hostname;
			} catch {
				return null;
			}
		})
		.filter((host): host is string => Boolean(host));

	if (hostnames.length) return [...new Set(hostnames)];

	return ['localhost'];
}

export function loadAppEnv(mode: string): Record<string, string> {
	return loadEnv(mode, process.cwd(), '');
}
