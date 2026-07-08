import { describe, expect, it } from 'vitest';
import { portalLoginUrl } from './portal-origin';

describe('portalLoginUrl', () => {
	it('falls back to local login when PORTAL_ORIGIN is unset', () => {
		const prev = process.env.PORTAL_ORIGIN;
		delete process.env.PORTAL_ORIGIN;
		expect(portalLoginUrl()).toBe('/auth/login');
		process.env.PORTAL_ORIGIN = prev;
	});

	it('builds portal login with redirectTo', () => {
		const prev = process.env.PORTAL_ORIGIN;
		process.env.PORTAL_ORIGIN = 'http://portal.local.test';
		const url = portalLoginUrl('http://drive.local.test/home');
		expect(url).toBe(
			'http://portal.local.test/auth/login?redirectTo=http%3A%2F%2Fdrive.local.test%2Fhome'
		);
		process.env.PORTAL_ORIGIN = prev;
	});
});
