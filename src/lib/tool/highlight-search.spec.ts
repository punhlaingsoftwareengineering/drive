import { describe, expect, it } from 'vitest';
import { highlightSearchParts } from './highlight-search';

describe('highlightSearchParts', () => {
	it('returns a single non-matching part when query is empty or whitespace', () => {
		expect(highlightSearchParts('My Document.txt', '')).toEqual([
			{ text: 'My Document.txt', match: false }
		]);
		expect(highlightSearchParts('My Document.txt', '   ')).toEqual([
			{ text: 'My Document.txt', match: false }
		]);
	});

	it('highlights a simple term in a case-insensitive way', () => {
		const parts = highlightSearchParts('Project Notes', 'project');
		expect(parts).toEqual([
			{ text: 'Project', match: true },
			{ text: ' Notes', match: false }
		]);
	});

	it('highlights multiple distinct terms, longest wins when overlapping', () => {
		const parts = highlightSearchParts('Team drive: marketing-2026', 'team market');
		const matches = parts.filter((p) => p.match).map((p) => p.text);
		expect(matches).toEqual(['Team', 'market']);
	});

	it('deduplicates repeated terms in the query', () => {
		const parts = highlightSearchParts('shared shared shared', 'shared shared');
		const matches = parts.filter((p) => p.match);
		expect(matches).toHaveLength(3);
		expect(matches.every((p) => p.text === 'shared')).toBe(true);
	});
});

