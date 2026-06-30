import { describe, expect, it } from 'vitest';
import { TRASH_RETENTION_DAYS } from './drive-trash-constants';

describe('TRASH_RETENTION_DAYS', () => {
	it('is 30 days', () => {
		expect(TRASH_RETENTION_DAYS).toBe(30);
	});
});
