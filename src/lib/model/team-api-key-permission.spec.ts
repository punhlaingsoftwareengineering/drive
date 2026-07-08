import { describe, expect, it } from 'vitest';
import {
	parseTeamApiKeyPermissions,
	permissionsGrantableByRole,
	validateTeamApiKeyPermissionsForRole
} from './team-api-key-permission';

describe('team-api-key-permission', () => {
	it('owner can grant team.delete', () => {
		expect(permissionsGrantableByRole('owner')).toContain('team.delete');
	});

	it('admin cannot grant team.delete', () => {
		expect(permissionsGrantableByRole('admin')).not.toContain('team.delete');
	});

	it('parses and validates permissions for role', () => {
		const perms = parseTeamApiKeyPermissions(['drive.read', 'drive.write', 'bad']);
		expect(perms).toEqual(['drive.read', 'drive.write']);
		expect(() =>
			validateTeamApiKeyPermissionsForRole(['drive.read', 'team.delete'], 'admin')
		).toThrow(/not allowed/);
	});
});
