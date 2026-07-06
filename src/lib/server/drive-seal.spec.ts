import { describe, expect, it } from 'vitest';
import { openFileBuffer, sealFileBuffer, shouldCompressMime } from './drive-seal';

describe('drive-seal', () => {
	it('skips compression for video MIME', () => {
		expect(shouldCompressMime('video/mp4')).toBe(false);
		expect(shouldCompressMime('audio/mpeg')).toBe(false);
		expect(shouldCompressMime('text/plain')).toBe(true);
	});

	it('skips compression for archive MIME', () => {
		expect(shouldCompressMime('application/x-tar')).toBe(false);
		expect(shouldCompressMime('application/x-bzip2')).toBe(false);
		expect(shouldCompressMime('application/x-zip-compressed')).toBe(false);
		expect(shouldCompressMime('application/zstd')).toBe(false);
	});

	it('may compress custom extension MIME', () => {
		expect(shouldCompressMime('application/x-custom')).toBe(true);
	});

	it('round-trips encrypt-only video buffer (ZNL2)', () => {
		const plain = Buffer.from('fake-mp4-bytes');
		const sealed = sealFileBuffer(plain, { mime: 'video/mp4' });
		expect(sealed.isCompressed).toBe(false);
		const out = openFileBuffer(sealed.buffer);
		expect(out.equals(plain)).toBe(true);
	});

	it('round-trips encrypt-only zip buffer (ZNL2)', () => {
		const plain = Buffer.from('PK\x03\x04fake-zip-bytes');
		const sealed = sealFileBuffer(plain, { mime: 'application/zip' });
		expect(sealed.isCompressed).toBe(false);
		const out = openFileBuffer(sealed.buffer);
		expect(out.equals(plain)).toBe(true);
	});

	it('round-trips compressed text buffer (ZNL1)', () => {
		const plain = Buffer.from('hello world '.repeat(20));
		const sealed = sealFileBuffer(plain, { mime: 'text/plain' });
		expect(sealed.isCompressed).toBe(true);
		const out = openFileBuffer(sealed.buffer);
		expect(out.equals(plain)).toBe(true);
	});
});
