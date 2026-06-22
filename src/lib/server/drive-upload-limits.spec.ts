import { afterEach, describe, expect, it, vi } from 'vitest';

describe('drive-upload-limits', () => {
	afterEach(() => {
		vi.resetModules();
		vi.unstubAllEnvs();
	});

	it('treats MAX_UPLOAD_BYTES=0 as unlimited', async () => {
		vi.stubEnv('MAX_UPLOAD_BYTES', '0');
		const { maxUploadBytes, assertWithinUploadLimit } = await import('./drive-upload-limits');
		expect(maxUploadBytes()).toBeNull();
		expect(() => assertWithinUploadLimit(10 * 1024 * 1024 * 1024)).not.toThrow();
	});

	it('enforces numeric MAX_UPLOAD_BYTES', async () => {
		vi.stubEnv('MAX_UPLOAD_BYTES', '1048576');
		const { assertWithinUploadLimit } = await import('./drive-upload-limits');
		expect(() => assertWithinUploadLimit(1048577)).toThrow(/File too large/);
	});
});
