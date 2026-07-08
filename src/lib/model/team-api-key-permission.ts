import type { TeamRole } from '$lib/model/team-role';

export const TEAM_API_KEY_PERMISSIONS = [
	'drive.read',
	'drive.write',
	'drive.delete',
	'drive.share',
	'invites.manage',
	'members.read',
	'members.manage',
	'team.settings',
	'team.delete'
] as const;

export type TeamApiKeyPermission = (typeof TEAM_API_KEY_PERMISSIONS)[number];

export const TEAM_API_KEY_PERMISSION_LABELS: Record<TeamApiKeyPermission, string> = {
	'drive.read': 'Browse & download',
	'drive.write': 'Upload & edit files',
	'drive.delete': 'Trash & delete',
	'drive.share': 'Share & public links',
	'invites.manage': 'Manage invites',
	'members.read': 'View members',
	'members.manage': 'Manage members',
	'team.settings': 'Rename team',
	'team.delete': 'Delete team'
};

export const TEAM_API_KEY_PERMISSION_GROUPS: Array<{
	title: string;
	permissions: TeamApiKeyPermission[];
}> = [
	{
		title: 'Team drive',
		permissions: ['drive.read', 'drive.write', 'drive.delete', 'drive.share']
	},
	{
		title: 'Team admin',
		permissions: [
			'invites.manage',
			'members.read',
			'members.manage',
			'team.settings',
			'team.delete'
		]
	}
];

export function isTeamApiKeyPermission(value: string): value is TeamApiKeyPermission {
	return (TEAM_API_KEY_PERMISSIONS as readonly string[]).includes(value);
}

export function permissionsGrantableByRole(role: TeamRole): TeamApiKeyPermission[] {
	const base: TeamApiKeyPermission[] = [
		'drive.read',
		'drive.write',
		'drive.delete',
		'drive.share',
		'invites.manage',
		'members.read',
		'members.manage',
		'team.settings'
	];
	if (role === 'owner') {
		return [...base, 'team.delete'];
	}
	return base;
}

export function parseTeamApiKeyPermissions(raw: unknown): TeamApiKeyPermission[] {
	if (!Array.isArray(raw)) return [];
	const out: TeamApiKeyPermission[] = [];
	for (const item of raw) {
		if (typeof item === 'string' && isTeamApiKeyPermission(item) && !out.includes(item)) {
			out.push(item);
		}
	}
	return out;
}

export function validateTeamApiKeyPermissionsForRole(
	permissions: TeamApiKeyPermission[],
	role: TeamRole
): void {
	if (permissions.length === 0) {
		throw new Error('At least one permission is required');
	}
	const allowed = new Set(permissionsGrantableByRole(role));
	for (const p of permissions) {
		if (!allowed.has(p)) {
			throw new Error(`Permission not allowed for your role: ${p}`);
		}
	}
}

export function teamApiKeyHasPermission(
	permissions: string[] | undefined,
	required: TeamApiKeyPermission
): boolean {
	return permissions?.includes(required) ?? false;
}

export function formatTeamApiKeyPermissionsSummary(permissions: string[] | undefined): string {
	if (!permissions?.length) return 'No permissions';
	return permissions.map((p) => TEAM_API_KEY_PERMISSION_LABELS[p as TeamApiKeyPermission] ?? p).join(', ');
}
