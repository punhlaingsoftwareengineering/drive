import { describe, expect, it } from 'vitest';
import { safeUploadFileName } from './drive-upload-persist';

describe('safeUploadFileName', () => {
	it('replaces path separators', () => {
		expect(safeUploadFileName('foo/bar.pdf')).toBe('foo_bar.pdf');
		expect(safeUploadFileName('..\\evil.txt')).toBe('.._evil.txt');
	});

	it('strips control characters', () => {
		expect(safeUploadFileName('bad\u0000name.txt')).toBe('badname.txt');
	});

	it('preserves extension when truncating', () => {
		const long = 'a'.repeat(300) + '.pdf';
		const result = safeUploadFileName(long);
		expect(result.endsWith('.pdf')).toBe(true);
		expect(result.length).toBeLessThanOrEqual(220);
	});

	it('normalizes unicode (NFKC)', () => {
		expect(safeUploadFileName('ﬁle.txt')).toBe('file.txt');
	});

	it('returns unnamed for empty input', () => {
		expect(safeUploadFileName('   ')).toBe('unnamed');
	});

	it('preserves custom extension filenames', () => {
		expect(safeUploadFileName('release.v2.backup')).toBe('release.v2.backup');
		expect(safeUploadFileName('data.myext')).toBe('data.myext');
		expect(safeUploadFileName('Makefile')).toBe('Makefile');
		expect(safeUploadFileName('.env')).toBe('.env');
		expect(safeUploadFileName('.gitignore')).toBe('.gitignore');
	});

	it('preserves custom extension when truncating', () => {
		const long = 'a'.repeat(300) + '.myext';
		const result = safeUploadFileName(long);
		expect(result.endsWith('.myext')).toBe(true);
		expect(result.length).toBeLessThanOrEqual(220);
	});
});
