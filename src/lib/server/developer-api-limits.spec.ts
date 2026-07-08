import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	db: {}
}));

import {
	normalizeDeveloperApiKeyLimits,
	serializeDeveloperApiKeyLimits
} from './developer-api-limits';

describe('developer-api-limits', () => {
	it('normalizes partial limit input to null defaults', () => {
		expect(normalizeDeveloperApiKeyLimits({ teams: 3, files: 10 })).toEqual({
			maxTeams: 3,
			maxFolders: null,
			maxFiles: 10
		});
	});

	it('serializes stored limits for API responses', () => {
		expect(
			serializeDeveloperApiKeyLimits({
				maxTeams: 2,
				maxFolders: null,
				maxFiles: 500
			})
		).toEqual({
			teams: 2,
			folders: null,
			files: 500
		});
	});
});
