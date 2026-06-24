import { describe, expect, it } from 'vitest';
import { iterateFileChunks } from './file-chunks';

describe('iterateFileChunks', () => {
	it('yields a single chunk for small blobs', () => {
		const file = new Blob(['hello']);
		const chunks = [...iterateFileChunks(file, 8)];
		expect(chunks).toHaveLength(1);
		expect(chunks[0]?.index).toBe(0);
		expect(chunks[0]?.chunkCount).toBe(1);
	});

	it('splits into multiple chunks and always slices from offset 0', () => {
		const file = new Blob(['abcdefghij']);
		const chunks = [...iterateFileChunks(file, 4)];
		expect(chunks).toHaveLength(3);
		expect(chunks.map((c) => c.index)).toEqual([0, 1, 2]);
		expect(chunks.every((c) => c.chunkCount === 3)).toBe(true);
	});

	it('computes chunkCount for sizes that cross the 2 GiB boundary', () => {
		const twoGiB = 2 * 1024 * 1024 * 1024;
		const chunkBytes = 8 * 1024 * 1024;
		const fileSize = twoGiB + chunkBytes;
		const chunkCount = Math.max(1, Math.ceil(fileSize / chunkBytes));
		expect(chunkCount).toBe(257);
	});
});
