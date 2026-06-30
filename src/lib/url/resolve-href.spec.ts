import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/paths', () => ({
	resolve: (path: string) => `/base${path.startsWith('/') ? '' : '/'}${path}`
}));

import { resolveHref } from './resolve-href';

describe('resolveHref', () => {
	it('delegates to $app/paths resolve()', () => {
		expect(resolveHref('/api/x')).toBe('/base/api/x');
		expect(resolveHref('api/x')).toBe('/base/api/x');
	});
});
