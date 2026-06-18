import { env } from '$env/dynamic/public';

export const DEFAULT_APP_NAME = 'ZNL-DRIVE';

/** Display name for navbar, titles, and user-facing copy (`PUBLIC_APP_NAME`). */
export function appName(): string {
	const configured = env.PUBLIC_APP_NAME?.trim();
	return configured || DEFAULT_APP_NAME;
}

/** Page title suffix, e.g. `Auth | My Drive`. */
export function appTitle(pageTitle: string, separator: ' | ' | ' · ' = ' · '): string {
	return `${pageTitle}${separator}${appName()}`;
}
