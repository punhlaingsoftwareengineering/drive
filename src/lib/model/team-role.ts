export type TeamRole = 'owner' | 'admin' | 'member';

export function normalizeTeamRole(role: string): TeamRole {
	if (role === 'owner') return 'owner';
	if (role === 'admin') return 'admin';
	return 'member';
}

export function isTeamAdminRole(role: TeamRole): boolean {
	return role === 'owner' || role === 'admin';
}

export function teamRoleLabel(role: TeamRole): string {
	if (role === 'owner') return 'Owner';
	if (role === 'admin') return 'Admin';
	return 'Member';
}
