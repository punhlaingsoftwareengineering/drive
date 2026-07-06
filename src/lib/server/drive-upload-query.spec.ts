import { describe, expect, it, vi } from 'vitest';
import { parseChunkUploadQuery, parseSimpleUploadQuery } from './drive-upload-query';

vi.mock('$lib/server/team-access', () => ({
	isTeamMember: vi.fn().mockResolvedValue(true)
}));

const userId = '00000000-0000-4000-8000-000000000001';

function uploadUrl(params: Record<string, string>): URL {
	return new URL(`http://localhost/api/drive/upload?${new URLSearchParams(params)}`);
}

describe('drive-upload-query MIME metadata', () => {
	it('parseSimpleUploadQuery infers known archive MIME', async () => {
		const result = await parseSimpleUploadQuery(
			uploadUrl({ fileName: 'archive.zip', mimeType: '' }),
			userId
		);
		expect(result.mimeType).toBe('application/zip');
	});

	it('parseSimpleUploadQuery infers custom extension MIME', async () => {
		const result = await parseSimpleUploadQuery(
			uploadUrl({ fileName: 'custom.myext', mimeType: 'application/octet-stream' }),
			userId
		);
		expect(result.mimeType).toBe('application/x-myext');
	});

	it('parseSimpleUploadQuery infers compound archive MIME', async () => {
		const result = await parseSimpleUploadQuery(
			uploadUrl({ fileName: 'weird.tar.gz' }),
			userId
		);
		expect(result.mimeType).toBe('application/gzip');
	});

	it('parseSimpleUploadQuery uses octet-stream for extensionless files', async () => {
		const result = await parseSimpleUploadQuery(uploadUrl({ fileName: 'Makefile' }), userId);
		expect(result.mimeType).toBe('application/octet-stream');
	});

	it('parseSimpleUploadQuery preserves specific browser MIME', async () => {
		const result = await parseSimpleUploadQuery(
			uploadUrl({ fileName: 'x.bin', mimeType: 'application/pdf' }),
			userId
		);
		expect(result.mimeType).toBe('application/pdf');
	});

	it('parseChunkUploadQuery init on chunk 0 carries same MIME logic', async () => {
		const url = uploadUrl({
			chunkIndex: '0',
			chunkCount: '2',
			fileName: 'model.blend',
			mimeType: 'application/octet-stream',
			storageProvider: 'local'
		});
		const result = await parseChunkUploadQuery(url, userId, 0);
		expect(result.init?.mimeType).toBe('application/x-blend');
		expect(result.init?.fileName).toBe('model.blend');
	});

	it('parseChunkUploadQuery omits init after chunk 0', async () => {
		const url = uploadUrl({
			chunkIndex: '1',
			chunkCount: '2',
			uploadId: 'session-1',
			fileName: 'ignored.bin'
		});
		const result = await parseChunkUploadQuery(url, userId, 1);
		expect(result.init).toBeUndefined();
	});
});
