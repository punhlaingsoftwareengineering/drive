import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pathState = { dataRoot: '' };

vi.mock('$lib/server/local-drive-path', () => ({
	localDriveDataRoot: () => pathState.dataRoot
}));

describe('drive-upload-chunk-store', () => {
	const userId = 'user-test';

	beforeEach(async () => {
		pathState.dataRoot = await mkdtemp(join(tmpdir(), 'znl-chunk-'));
		vi.resetModules();
	});

	afterEach(async () => {
		if (pathState.dataRoot) {
			await rm(pathState.dataRoot, { recursive: true, force: true }).catch(() => undefined);
			pathState.dataRoot = '';
		}
	});

	it('assembles multi-chunk upload on disk', async () => {
		const { appendChunk, assembledPath, assembledSize, removeSession } = await import(
			'./drive-upload-chunk-store'
		);

		const init = {
			fileName: 'clip.mp4',
			mimeType: 'video/mp4',
			storageProvider: 'local' as const,
			parentId: null,
			teamId: null
		};

		const c0 = Buffer.from('part-a-');
		const c1 = Buffer.from('part-b');

		const first = await appendChunk(userId, null, 0, 2, c0, init);
		await appendChunk(userId, first.uploadId, 1, 2, c1);

		expect(await assembledSize(userId, first.uploadId)).toBe(c0.length + c1.length);
		const onDisk = await readFile(assembledPath(userId, first.uploadId));
		expect(onDisk.toString()).toBe('part-a-part-b');

		await removeSession(userId, first.uploadId);
	});
});
