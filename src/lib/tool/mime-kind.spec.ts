import { describe, expect, it } from 'vitest';
import { effectiveContentType, guessMimeFromFileName, normalizeUploadMime } from './mime-kind';

describe('mime-kind', () => {
	it('guesses common extensions', () => {
		expect(guessMimeFromFileName('report.pdf')).toBe('application/pdf');
		expect(guessMimeFromFileName('photo.JPG')).toBe('image/jpeg');
		expect(guessMimeFromFileName('archive.zip')).toBe('application/zip');
		expect(guessMimeFromFileName('notes.txt')).toBe('text/plain');
	});

	it('normalizes empty browser MIME from filename', () => {
		expect(normalizeUploadMime('data.csv', '')).toBe('text/csv');
		expect(normalizeUploadMime('data.csv', 'application/octet-stream')).toBe('text/csv');
	});

	it('keeps specific browser MIME', () => {
		expect(normalizeUploadMime('file.bin', 'application/pdf')).toBe('application/pdf');
	});

	it('falls back to octet-stream when unknown', () => {
		expect(normalizeUploadMime('noext', '')).toBe('application/octet-stream');
		expect(guessMimeFromFileName('noext')).toBeUndefined();
	});

	it('effectiveContentType prefers stored MIME', () => {
		expect(effectiveContentType('image/png', 'x.unknown')).toBe('image/png');
	});

	it('effectiveContentType guesses when stored is generic', () => {
		expect(effectiveContentType('application/octet-stream', 'doc.pdf')).toBe('application/pdf');
		expect(effectiveContentType(null, 'pic.webp')).toBe('image/webp');
	});
});
