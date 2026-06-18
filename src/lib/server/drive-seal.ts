import { env } from '$env/dynamic/private';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import {
	brotliCompressSync,
	brotliDecompressSync,
	constants as brotliConstants,
	gunzipSync,
	gzipSync
} from 'node:zlib';

const MAGIC = Buffer.from('ZNL1', 'ascii');
const FLAG_GZIP = 0x01;
const FLAG_ENC = 0x02;
const FLAG_BROTLI = 0x04;

function getKey(): Buffer {
	const secret =
		env.DRIVE_ENCRYPTION_KEY ?? env.FILE_ENCRYPTION_KEY ?? env.BETTER_AUTH_SECRET;
	if (!secret) {
		throw new Error(
			'Set DRIVE_ENCRYPTION_KEY, FILE_ENCRYPTION_KEY, or BETTER_AUTH_SECRET for at-rest file encryption'
		);
	}
	return scryptSync(secret, Buffer.from('znl-drive-file-v1', 'utf8'), 32);
}

/** Pick smallest payload: Brotli Q11 vs gzip L9, then AES-256-GCM. */
export function sealFileBuffer(plain: Buffer): { buffer: Buffer; originalSize: number } {
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
	const buffer = Buffer.concat([MAGIC, Buffer.from([flags]), origSizeBuf, iv, tag, enc]);
	return { buffer, originalSize: plain.length };
}

export function isSealedBlob(buf: Buffer): boolean {
	return buf.length >= 4 && buf.subarray(0, 4).equals(MAGIC);
}

/** Decrypt (+ brotli or gzip if sealed). Legacy uploads (no magic) are returned unchanged. */
export function openFileBuffer(stored: Buffer): Buffer {
	if (!isSealedBlob(stored)) {
		return stored;
	}
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
