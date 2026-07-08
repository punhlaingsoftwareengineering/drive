import { describe, expect, it } from 'vitest';
import { getAuthSessionOptions } from './auth-session-config';

describe('getAuthSessionOptions', () => {
	it('defaults to 7d session and 30m cache/update', () => {
		const prev = { ...process.env };
		delete process.env.AUTH_SESSION_EXPIRES_IN;
		delete process.env.AUTH_SESSION_UPDATE_AGE;
		delete process.env.AUTH_SESSION_COOKIE_CACHE_MAX_AGE;
		delete process.env.AUTH_COOKIE_DOMAIN;
		delete process.env.AUTH_SESSION_SECURE_COOKIES;

		const { session } = getAuthSessionOptions();
		expect(session.expiresIn).toBe(7 * 24 * 60 * 60);
		expect(session.updateAge).toBe(30 * 60);
		expect(session.cookieCache?.maxAge).toBe(30 * 60);

		process.env = prev;
	});

	it('enables crossSubDomainCookies when AUTH_COOKIE_DOMAIN is set', () => {
		const prev = process.env.AUTH_COOKIE_DOMAIN;
		process.env.AUTH_COOKIE_DOMAIN = '.local.test';
		const { advanced } = getAuthSessionOptions();
		expect(advanced.crossSubDomainCookies).toEqual({
			enabled: true,
			domain: '.local.test'
		});
		process.env.AUTH_COOKIE_DOMAIN = prev;
	});
});
