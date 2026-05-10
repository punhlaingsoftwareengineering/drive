import { describe, expect, it } from 'vitest';
import { pathWithoutBase } from './path-without-base';

describe('pathWithoutBase', () => {
	it('returns root for empty or "/" when base is default', () => {
		import.meta.env.BASE_URL = '/';
		expect(pathWithoutBase('/')).toBe('/');
		expect(pathWithoutBase('')).toBe('/');
	});

	it('strips configured base prefix and normalises trailing slash', () => {
		import.meta.env.BASE_URL = '/app/';
		expect(pathWithoutBase('/app')).toBe('/');
		expect(pathWithoutBase('/app/')).toBe('/');
		expect(pathWithoutBase('/app/home')).toBe('/home');
		expect(pathWithoutBase('/app/home/')).toBe('/home');
	});

	it('leaves unrelated paths unchanged', () => {
		import.meta.env.BASE_URL = '/app';
		expect(pathWithoutBase('/other/home')).toBe('/other/home');
	});
});

