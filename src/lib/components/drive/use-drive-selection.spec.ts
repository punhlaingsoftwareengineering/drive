import { describe, expect, it } from 'vitest';
import {
	filterTopLevelMoveIds,
	replacePathPrefix,
	wouldCreateMoveCycle
} from '$lib/server/drive-move';
import { selectRangeIds, allItemsPass } from '$lib/components/drive/use-drive-selection.svelte';

describe('use-drive-selection helpers', () => {
	it('selectRangeIds selects inclusive range', () => {
		const ordered = ['a', 'b', 'c', 'd'];
		const next = selectRangeIds('b', 'd', ordered, new Set(['a']));
		expect([...next]).toEqual(['a', 'b', 'c', 'd']);
	});

	it('allItemsPass requires non-empty and all true', () => {
		expect(allItemsPass([1, 2], (n) => n > 0)).toBe(true);
		expect(allItemsPass([], (n) => n > 0)).toBe(false);
		expect(allItemsPass([1, 0], (n) => n > 0)).toBe(false);
	});
});

describe('drive-move helpers', () => {
	it('wouldCreateMoveCycle detects self and descendant targets', () => {
		const descendants = new Set(['folder-a', 'child-1', 'child-2']);
		expect(wouldCreateMoveCycle('folder-a', 'folder-a', descendants)).toBe(true);
		expect(wouldCreateMoveCycle('folder-a', 'child-1', descendants)).toBe(true);
		expect(wouldCreateMoveCycle('folder-a', 'other', descendants)).toBe(false);
		expect(wouldCreateMoveCycle('folder-a', null, descendants)).toBe(false);
	});

	it('filterTopLevelMoveIds skips nested selections', () => {
		const rows = new Map([
			['parent', { parentId: null }],
			['child', { parentId: 'parent' }]
		]);
		expect(filterTopLevelMoveIds(['parent', 'child'], rows)).toEqual(['parent']);
	});

	it('replacePathPrefix updates subtree paths', () => {
		const oldP = '/data/user/folder/abc';
		const newP = '/data/user/folder/xyz';
		expect(replacePathPrefix(oldP, newP, `${oldP}/file-1`)).toBe(`${newP}/file-1`);
	});
});
