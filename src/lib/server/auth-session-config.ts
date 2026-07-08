import { env } from '$env/dynamic/private';

const DURATION_REGEX =
	/^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|months?|mo|years?|yrs?|y)(?: (ago|from now))?$/i;

const MS_PER_UNIT = {
	s: 1_000,
	m: 60_000,
	h: 3_600_000,
	d: 86_400_000,
	w: 604_800_000,
	mo: 2_592_000_000,
	y: 31_557_600_000
} as const;

function envString(key: string): string | undefined {
	const fromDynamic = (env as Record<string, string | undefined>)[key];
	if (typeof fromDynamic === 'string' && fromDynamic.trim()) return fromDynamic.trim();
	const fromProcess = process.env[key];
	if (typeof fromProcess === 'string' && fromProcess.trim()) return fromProcess.trim();
	return undefined;
}

function parseDurationMs(value: string): number {
	const trimmed = value.trim();
	if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1_000;

	const match = DURATION_REGEX.exec(trimmed);
	if (!match || (match[4] && match[1])) {
		throw new TypeError(`Invalid duration: "${value}". Use formats like "7d", "30m", or seconds.`);
	}

	const n = parseFloat(match[2]);
	const unit = match[3].toLowerCase();
	let multiplier: number;

	switch (unit) {
		case 'years':
		case 'year':
		case 'yrs':
		case 'yr':
		case 'y':
			multiplier = MS_PER_UNIT.y;
			break;
		case 'months':
		case 'month':
		case 'mo':
			multiplier = MS_PER_UNIT.mo;
			break;
		case 'weeks':
		case 'week':
		case 'w':
			multiplier = MS_PER_UNIT.w;
			break;
		case 'days':
		case 'day':
		case 'd':
			multiplier = MS_PER_UNIT.d;
			break;
		case 'hours':
		case 'hour':
		case 'hrs':
		case 'hr':
		case 'h':
			multiplier = MS_PER_UNIT.h;
			break;
		case 'minutes':
		case 'minute':
		case 'mins':
		case 'min':
		case 'm':
			multiplier = MS_PER_UNIT.m;
			break;
		case 'seconds':
		case 'second':
		case 'secs':
		case 'sec':
		case 's':
			multiplier = MS_PER_UNIT.s;
			break;
		default:
			throw new TypeError(`Unknown time unit: "${unit}"`);
	}

	const result = n * multiplier;
	if (match[1] === '-' || match[4] === 'ago') return -result;
	return result;
}

function parseDurationSeconds(value: string | undefined, fallback: string): number {
	const raw = value?.trim() || fallback;
	return Math.round(parseDurationMs(raw) / 1_000);
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
	if (value === undefined || value.trim() === '') return fallback;

	const normalized = value.trim().toLowerCase();
	if (normalized === 'true' || normalized === '1') return true;
	if (normalized === 'false' || normalized === '0') return false;

	throw new TypeError(`Invalid boolean env value: "${value}". Use true/false or 1/0.`);
}

function parseOptionalBooleanEnv(value: string | undefined): boolean | undefined {
	if (value === undefined || value.trim() === '') return undefined;
	return parseBooleanEnv(value, false);
}

export function getAuthSessionOptions() {
	const expiresIn = parseDurationSeconds(envString('AUTH_SESSION_EXPIRES_IN'), '7d');
	const updateAge = parseDurationSeconds(envString('AUTH_SESSION_UPDATE_AGE'), '30m');
	const cookieCacheEnabled = parseBooleanEnv(envString('AUTH_SESSION_COOKIE_CACHE_ENABLED'), true);
	const cookieCacheMaxAge = parseDurationSeconds(
		envString('AUTH_SESSION_COOKIE_CACHE_MAX_AGE'),
		'30m'
	);
	const secureCookies = parseOptionalBooleanEnv(envString('AUTH_SESSION_SECURE_COOKIES'));
	const cookieDomain = envString('AUTH_COOKIE_DOMAIN');

	const advanced: {
		useSecureCookies?: boolean;
		crossSubDomainCookies?: { enabled: boolean; domain: string };
	} = {};

	if (secureCookies !== undefined) {
		advanced.useSecureCookies = secureCookies;
	} else {
		const origin = envString('ORIGIN');
		if (origin?.startsWith('https://')) {
			advanced.useSecureCookies = true;
		}
	}
	if (cookieDomain) {
		advanced.crossSubDomainCookies = { enabled: true, domain: cookieDomain };
	}

	return {
		session: {
			expiresIn,
			updateAge,
			cookieCache: {
				enabled: cookieCacheEnabled,
				maxAge: cookieCacheMaxAge
			}
		},
		advanced
	};
}
