export type TeamScopeView = 'home' | 'shared' | 'recent' | 'trash' | 'dashboard' | 'settings';

export const TEAM_SCOPE_SUBPATHS = ['shared', 'recent', 'trash', 'dashboard', 'settings'] as const;

export type TeamScopeSubpath = (typeof TEAM_SCOPE_SUBPATHS)[number];

export function isTeamScopeSubpath(value: string): value is TeamScopeSubpath {
	return (TEAM_SCOPE_SUBPATHS as readonly string[]).includes(value);
}

export function parseTeamScopeView(subPath: string | null): TeamScopeView {
	if (subPath && isTeamScopeSubpath(subPath)) return subPath;
	return 'home';
}
