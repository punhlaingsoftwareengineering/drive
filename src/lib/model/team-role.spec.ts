import { describe, expect, it } from 'vitest';
import { isTeamAdminRole, normalizeTeamRole, teamRoleLabel } from '$lib/model/team-role';

describe('team-role', () => {
	it('normalizes roles', () => {
		expect(normalizeTeamRole('owner')).toBe('owner');
		expect(normalizeTeamRole('admin')).toBe('admin');
		expect(normalizeTeamRole('member')).toBe('member');
		expect(normalizeTeamRole('unknown')).toBe('member');
	});

	it('detects admin-capable roles', () => {
		expect(isTeamAdminRole('owner')).toBe(true);
		expect(isTeamAdminRole('admin')).toBe(true);
		expect(isTeamAdminRole('member')).toBe(false);
	});

	it('labels roles', () => {
		expect(teamRoleLabel('owner')).toBe('Owner');
		expect(teamRoleLabel('admin')).toBe('Admin');
		expect(teamRoleLabel('member')).toBe('Member');
	});
});
