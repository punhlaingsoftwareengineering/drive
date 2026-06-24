/**
 * Yield fixed-size chunks from a `File`/`Blob` without passing slice start offsets past
 * 2^31 - 1. Browsers coerce `Blob.slice(start)` to signed 32-bit; absolute offsets at or
 * above 2 GiB break chunked uploads for large files.
 */
export function* iterateFileChunks(
	file: Blob,
	chunkBytes: number
): Generator<{ chunk: Blob; index: number; chunkCount: number }, void, unknown> {
	if (chunkBytes < 1) throw new RangeError('chunkBytes must be positive');

	const chunkCount = Math.max(1, Math.ceil(file.size / chunkBytes));
	let remaining: Blob = file;
	let index = 0;

	while (remaining.size > 0) {
		const take = Math.min(chunkBytes, remaining.size);
		yield { chunk: remaining.slice(0, take), index, chunkCount };
		remaining = remaining.slice(take);
		index += 1;
	}
}
