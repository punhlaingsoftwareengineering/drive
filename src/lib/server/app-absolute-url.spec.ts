import { describe, expect, it, vi } from 'vitest';
import { appAbsoluteUrlFromRequest } from './app-absolute-url';

describe('appAbsoluteUrlFromRequest', () => {
	it('builds an absolute URL with origin and pathname', () => {
		vi.stubEnv('BASE_URL', '/');
		expect(appAbsoluteUrlFromRequest('http://localhost:1025/some/page', '/api/drive/files')).toBe(
			'http://localhost:1025/api/drive/files'
		);
	});

	it('normalizes missing leading slash on pathname', () => {
		vi.stubEnv('BASE_URL', '/');
		expect(appAbsoluteUrlFromRequest('https://example.com/', 'api/x')).toBe(
			'https://example.com/api/x'
		);
	});

	it('includes non-root BASE_URL without double slashes', () => {
		vi.stubEnv('BASE_URL', '/app/');
		expect(appAbsoluteUrlFromRequest('https://example.com/anything', '/api/x')).toBe(
			'https://example.com/app/api/x'
		);
	});
});
