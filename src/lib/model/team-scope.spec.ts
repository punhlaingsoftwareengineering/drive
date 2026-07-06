import { describe, expect, it } from 'vitest';
import {
	isTeamScopeSubpath,
	parseTeamScopeView,
	TEAM_SCOPE_SUBPATHS
} from '$lib/model/team-scope';

describe('team-scope', () => {
	it('lists expected subpaths', () => {
		expect(TEAM_SCOPE_SUBPATHS).toEqual(['shared', 'recent', 'trash', 'dashboard']);
	});

	it('recognizes valid subpaths', () => {
		expect(isTeamScopeSubpath('shared')).toBe(true);
		expect(isTeamScopeSubpath('home')).toBe(false);
		expect(isTeamScopeSubpath('unknown')).toBe(false);
	});

	it('parses team scope view from path segment', () => {
		expect(parseTeamScopeView(null)).toBe('home');
		expect(parseTeamScopeView('')).toBe('home');
		expect(parseTeamScopeView('shared')).toBe('shared');
		expect(parseTeamScopeView('dashboard')).toBe('dashboard');
		expect(parseTeamScopeView('bogus')).toBe('home');
	});
});
