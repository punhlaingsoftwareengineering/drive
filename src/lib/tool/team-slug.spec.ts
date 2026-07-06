import { describe, expect, it } from 'vitest';
import { isUuidLike, slugifyTeamName } from './team-slug';

describe('team-slug', () => {
	it('slugifies team names', () => {
		expect(slugifyTeamName('My Cool Team')).toBe('my-cool-team');
		expect(slugifyTeamName('  ')).toBe('team');
	});

	it('detects uuid-like segments', () => {
		expect(isUuidLike('9a3d5a6e-7f68-4f2a-9f7d-20e7a4c9e6d1')).toBe(true);
		expect(isUuidLike('my-cool-team')).toBe(false);
	});
});
