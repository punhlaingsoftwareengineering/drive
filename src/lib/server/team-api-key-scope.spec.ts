import { describe, expect, it } from 'vitest';
import {
	assertTeamKeyCanCreateTeam,
	assertTeamRouteAccess,
	resolveEffectiveTeamId,
	resolveEffectiveTeamIdParam
} from './team-api-key-scope';
import type { DriveApiSession } from './require-api-session';

const teamId = '9a3d5a6e-7f68-4f2a-9f7d-20e7a4c9e6d1';

function teamSession(): DriveApiSession {
	return {
		user: { id: 'u1' },
		viaApiKey: true,
		apiKeyTeamId: teamId,
		apiKeyPermissions: ['drive.read']
	};
}

function expectStatus(fn: () => unknown, status: number) {
	try {
		fn();
		throw new Error('expected throw');
	} catch (e) {
		expect(e).toMatchObject({ status });
	}
}

describe('team-api-key-scope', () => {
	it('defaults teamId from bound team key', () => {
		const url = new URL('http://localhost/api/drive/files?storageProvider=local');
		expect(resolveEffectiveTeamId(teamSession(), url)).toBe(teamId);
	});

	it('rejects mismatched teamId', () => {
		const url = new URL(
			`http://localhost/api/drive/files?teamId=00000000-0000-4000-8000-000000000001`
		);
		expectStatus(() => resolveEffectiveTeamId(teamSession(), url), 403);
	});

	it('resolveEffectiveTeamIdParam defaults for team keys', () => {
		expect(resolveEffectiveTeamIdParam(teamSession(), undefined)).toBe(teamId);
	});

	it('blocks team keys from creating teams', () => {
		expectStatus(() => assertTeamKeyCanCreateTeam(teamSession()), 403);
	});

	it('assertTeamRouteAccess allows bound team', () => {
		expect(() => assertTeamRouteAccess(teamSession(), teamId)).not.toThrow();
	});
});
