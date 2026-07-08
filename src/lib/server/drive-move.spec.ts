import { describe, expect, it } from 'vitest';
import { replacePathPrefix } from '$lib/server/drive-move';

describe('drive-move path helpers', () => {
	it('replacePathPrefix handles exact match', () => {
		expect(replacePathPrefix('/a/b', '/x/y', '/a/b')).toBe('/x/y');
	});

	it('replacePathPrefix handles posix nested paths', () => {
		expect(replacePathPrefix('/users/u1/folder/f1', '/users/u1/folder/f2', '/users/u1/folder/f1/nested'))
			.toBe('/users/u1/folder/f2/nested');
	});
});
