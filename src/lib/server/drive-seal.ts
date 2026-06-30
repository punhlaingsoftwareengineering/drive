import { env } from '$env/dynamic/private';
import { IN_MEMORY_SEAL_THRESHOLD_BYTES } from '$lib/server/drive-upload-limits';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import {
	brotliCompressSync,
	brotliDecompressSync,
	constants as brotliConstants,
	gunzipSync,
	gzipSync
} from 'node:zlib';

const MAGIC_V1 = Buffer.from('ZNL1', 'ascii');
const MAGIC_V2 = Buffer.from('ZNL2', 'ascii');
const FLAG_GZIP = 0x01;
const FLAG_ENC = 0x02;
const FLAG_BROTLI = 0x04;

const V2_HEADER_BYTES = 4 + 1 + 8 + 12; // magic + flags + uint64 size + iv
const V2_TRAILER_BYTES = 16; // GCM tag at end

function getKey(): Buffer {
	const secret = env.DRIVE_ENCRYPTION_KEY ?? env.FILE_ENCRYPTION_KEY ?? env.BETTER_AUTH_SECRET;
	if (!secret) {
		throw new Error(
			'Set DRIVE_ENCRYPTION_KEY, FILE_ENCRYPTION_KEY, or BETTER_AUTH_SECRET for at-rest file encryption'
		);
	}
	return scryptSync(secret, Buffer.from('znl-drive-file-v1', 'utf8'), 32);
}

/** Skip Brotli/gzip for already-compressed media and archives. */
export function shouldCompressMime(mime: string): boolean {
	const m = (mime ?? '').trim().toLowerCase();
	if (!m) return true;
	if (m.startsWith('video/') || m.startsWith('audio/')) return false;
	if (
		m === 'application/zip' ||
		m === 'application/gzip' ||
		m === 'application/x-gzip' ||
		m === 'application/x-7z-compressed' ||
		m === 'application/vnd.rar' ||
		m.startsWith('image/')
	) {
		return false;
	}
	return true;
}

function writeOrigSizeV2(buf: Buffer, size: number): void {
	const big = BigInt(size);
	buf.writeBigUInt64BE(big, 0);
}

function readOrigSizeV2(buf: Buffer): number {
	const big = buf.readBigUInt64BE(0);
	if (big > BigInt(Number.MAX_SAFE_INTEGER)) {
		throw new Error('File size exceeds JavaScript safe integer range');
	}
	return Number(big);
}

function sealEncryptOnlyBuffer(plain: Buffer): { buffer: Buffer; originalSize: number } {
	const key = getKey();
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
	const tag = cipher.getAuthTag();
	const flags = FLAG_ENC;
	const origSizeBuf = Buffer.allocUnsafe(8);
	writeOrigSizeV2(origSizeBuf, plain.length);
	const buffer = Buffer.concat([MAGIC_V2, Buffer.from([flags]), origSizeBuf, iv, enc, tag]);
	return { buffer, originalSize: plain.length };
}

/** Pick smallest payload: Brotli Q11 vs gzip L9, then AES-256-GCM (ZNL1). */
export function sealFileBuffer(
	plain: Buffer,
	opts?: { mime?: string }
): { buffer: Buffer; originalSize: number; isCompressed: boolean } {
	if (!shouldCompressMime(opts?.mime ?? '')) {
		const sealed = sealEncryptOnlyBuffer(plain);
		return { ...sealed, isCompressed: false };
	}

	const br = brotliCompressSync(plain, {
		params: {
			[brotliConstants.BROTLI_PARAM_QUALITY]: 11,
			[brotliConstants.BROTLI_PARAM_SIZE_HINT]: plain.length
		}
	});
	const gz = gzipSync(plain, { level: 9 });
	const useBrotli = br.length <= gz.length;
	const compressed = useBrotli ? br : gz;
	const flags = (useBrotli ? FLAG_BROTLI : FLAG_GZIP) | FLAG_ENC;

	const key = getKey();
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const enc = Buffer.concat([cipher.update(compressed), cipher.final()]);
	const tag = cipher.getAuthTag();
	const origSizeBuf = Buffer.allocUnsafe(4);
	origSizeBuf.writeUInt32BE(plain.length >>> 0, 0);
	const buffer = Buffer.concat([MAGIC_V1, Buffer.from([flags]), origSizeBuf, iv, tag, enc]);
	return { buffer, originalSize: plain.length, isCompressed: true };
}

/** Stream seal to disk (ZNL2, encrypt-only). For large uploads without loading RAM. */
export async function sealFileStream(
	inputPath: string,
	outputPath: string,
	opts: { mime?: string; originalSize: number }
): Promise<{ originalSize: number; isCompressed: boolean }> {
	const compress =
		shouldCompressMime(opts.mime ?? '') && opts.originalSize <= IN_MEMORY_SEAL_THRESHOLD_BYTES;
	if (compress) {
		const { readFile } = await import('node:fs/promises');
		const plain = await readFile(inputPath);
		const sealed = sealFileBuffer(plain, { mime: opts.mime });
		await import('node:fs/promises').then(({ writeFile }) => writeFile(outputPath, sealed.buffer));
		return { originalSize: sealed.originalSize, isCompressed: sealed.isCompressed };
	}

	const key = getKey();
	const iv = randomBytes(12);
	const flags = FLAG_ENC;
	const origSizeBuf = Buffer.allocUnsafe(8);
	writeOrigSizeV2(origSizeBuf, opts.originalSize);

	const readStream = createReadStream(inputPath);
	const writeStream = createWriteStream(outputPath, { flags: 'w' });
	const cipher = createCipheriv('aes-256-gcm', key, iv);

	writeStream.write(MAGIC_V2);
	writeStream.write(Buffer.from([flags]));
	writeStream.write(origSizeBuf);
	writeStream.write(iv);

	await pipeline(readStream, cipher, writeStream);
	const tag = cipher.getAuthTag();
	const fh = await open(outputPath, 'a');
	try {
		await fh.write(tag);
	} finally {
		await fh.close();
	}

	return { originalSize: opts.originalSize, isCompressed: false };
}

export function isSealedBlob(buf: Buffer): boolean {
	if (buf.length < 4) return false;
	const magic = buf.subarray(0, 4);
	return magic.equals(MAGIC_V1) || magic.equals(MAGIC_V2);
}

function openFileBufferV1(stored: Buffer): Buffer {
	let o = 4;
	const flags = stored[o++];
	const expectedOrig = stored.readUInt32BE(o);
	o += 4;
	const iv = stored.subarray(o, o + 12);
	o += 12;
	const tag = stored.subarray(o, o + 16);
	o += 16;
	const enc = stored.subarray(o);
	const key = getKey();
	const decipher = createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAuthTag(tag);
	let out = Buffer.concat([decipher.update(enc), decipher.final()]);
	if (flags & FLAG_BROTLI) {
		out = brotliDecompressSync(out);
	} else if (flags & FLAG_GZIP) {
		out = gunzipSync(out);
	}
	if (out.length !== expectedOrig) {
		console.warn('[drive-seal] decoded length does not match header');
	}
	return out;
}

function openFileBufferV2(stored: Buffer): Buffer {
	let o = 4;
	const flags = stored[o++];
	const expectedOrig = readOrigSizeV2(stored.subarray(o, o + 8));
	o += 8;
	const iv = stored.subarray(o, o + 12);
	o += 12;
	if (stored.length < o + V2_TRAILER_BYTES) {
		throw new Error('Truncated sealed blob (ZNL2)');
	}
	const tag = stored.subarray(stored.length - V2_TRAILER_BYTES);
	const enc = stored.subarray(o, stored.length - V2_TRAILER_BYTES);
	const key = getKey();
	const decipher = createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAuthTag(tag);
	const out = Buffer.concat([decipher.update(enc), decipher.final()]);
	if (out.length !== expectedOrig) {
		console.warn('[drive-seal] decoded length does not match ZNL2 header');
	}
	if (flags & FLAG_BROTLI) {
		return brotliDecompressSync(out);
	}
	if (flags & FLAG_GZIP) {
		return gunzipSync(out);
	}
	return out;
}

/** Decrypt (+ brotli or gzip if sealed). Legacy uploads (no magic) are returned unchanged. */
export function openFileBuffer(stored: Buffer): Buffer {
	if (!isSealedBlob(stored)) {
		return stored;
	}
	if (stored.subarray(0, 4).equals(MAGIC_V2)) {
		return openFileBufferV2(stored);
	}
	return openFileBufferV1(stored);
}

export const SEAL_V2_HEADER_BYTES = V2_HEADER_BYTES;
