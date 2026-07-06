import { describe, expect, it } from 'vitest';
import {
	effectiveContentType,
	guessMimeFromFileName,
	isArchiveMime,
	isCustomExtensionMime,
	normalizeUploadMime
} from './mime-kind';

describe('mime-kind', () => {
	it('guesses common extensions', () => {
		expect(guessMimeFromFileName('report.pdf')).toBe('application/pdf');
		expect(guessMimeFromFileName('photo.JPG')).toBe('image/jpeg');
		expect(guessMimeFromFileName('archive.zip')).toBe('application/zip');
		expect(guessMimeFromFileName('notes.txt')).toBe('text/plain');
	});

	it('guesses archive extensions', () => {
		expect(guessMimeFromFileName('backup.tar')).toBe('application/x-tar');
		expect(guessMimeFromFileName('data.7z')).toBe('application/x-7z-compressed');
		expect(guessMimeFromFileName('release.rar')).toBe('application/vnd.rar');
		expect(guessMimeFromFileName('payload.gz')).toBe('application/gzip');
		expect(guessMimeFromFileName('bundle.tgz')).toBe('application/gzip');
		expect(guessMimeFromFileName('bundle.txz')).toBe('application/x-xz');
		expect(guessMimeFromFileName('app.apk')).toBe('application/vnd.android.package-archive');
	});

	it('guesses compound archive extensions before single suffix', () => {
		expect(guessMimeFromFileName('backup.tar.gz')).toBe('application/gzip');
		expect(guessMimeFromFileName('backup.tar.bz2')).toBe('application/x-bzip2');
		expect(guessMimeFromFileName('backup.tar.xz')).toBe('application/x-xz');
		expect(guessMimeFromFileName('backup.tar.zst')).toBe('application/zstd');
	});

	it('identifies archive MIME types', () => {
		expect(isArchiveMime('application/zip')).toBe(true);
		expect(isArchiveMime('application/x-tar')).toBe(true);
		expect(isArchiveMime('application/x-bzip2')).toBe(true);
		expect(isArchiveMime('application/x-zip-compressed')).toBe(true);
		expect(isArchiveMime('application/zstd')).toBe(true);
		expect(isArchiveMime('text/plain')).toBe(false);
		expect(isArchiveMime('application/x-blend')).toBe(false);
		expect(isArchiveMime('')).toBe(false);
	});

	it('guesses custom extension MIME as application/x-{ext}', () => {
		expect(guessMimeFromFileName('model.blend')).toBe('application/x-blend');
		expect(guessMimeFromFileName('data.myext')).toBe('application/x-myext');
		expect(guessMimeFromFileName('backup.v2.znl')).toBe('application/x-znl');
	});

	it('identifies custom extension MIME types', () => {
		expect(isCustomExtensionMime('application/x-blend')).toBe(true);
		expect(isCustomExtensionMime('application/x-tar')).toBe(false);
		expect(isCustomExtensionMime('application/zip')).toBe(false);
	});

	it('normalizes empty browser MIME from filename', () => {
		expect(normalizeUploadMime('data.csv', '')).toBe('text/csv');
		expect(normalizeUploadMime('data.csv', 'application/octet-stream')).toBe('text/csv');
		expect(normalizeUploadMime('backup.tar.gz', '')).toBe('application/gzip');
	});

	it('keeps specific browser MIME', () => {
		expect(normalizeUploadMime('file.bin', 'application/pdf')).toBe('application/pdf');
	});

	it('falls back to octet-stream when no extension', () => {
		expect(normalizeUploadMime('noext', '')).toBe('application/octet-stream');
		expect(guessMimeFromFileName('noext')).toBeUndefined();
		expect(normalizeUploadMime('custom.myext', '')).toBe('application/x-myext');
	});

	it('effectiveContentType prefers stored MIME', () => {
		expect(effectiveContentType('image/png', 'x.unknown')).toBe('image/png');
	});

	it('effectiveContentType guesses when stored is generic', () => {
		expect(effectiveContentType('application/octet-stream', 'doc.pdf')).toBe('application/pdf');
		expect(effectiveContentType(null, 'pic.webp')).toBe('image/webp');
		expect(effectiveContentType('application/octet-stream', 'backup.tar')).toBe('application/x-tar');
		expect(effectiveContentType(null, 'bundle.tar.gz')).toBe('application/gzip');
		expect(effectiveContentType('application/octet-stream', 'model.blend')).toBe(
			'application/x-blend'
		);
	});
});
