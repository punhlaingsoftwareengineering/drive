import { env } from '$env/dynamic/private';
import { UPLOAD_CHUNK_BYTES } from '$lib/upload/chunk-bytes';

export { UPLOAD_CHUNK_BYTES };

/** Files at or below this size may use in-memory seal on finalize. */
export const IN_MEMORY_SEAL_THRESHOLD_BYTES = UPLOAD_CHUNK_BYTES;

function readMaxUploadBytes(): number | null {
	const raw =
		(typeof env.MAX_UPLOAD_BYTES === 'string' && env.MAX_UPLOAD_BYTES.trim()
			? env.MAX_UPLOAD_BYTES.trim()
			: undefined) ??
		(typeof process.env.MAX_UPLOAD_BYTES === 'string' && process.env.MAX_UPLOAD_BYTES.trim()
			? process.env.MAX_UPLOAD_BYTES.trim()
			: undefined);
	if (!raw || raw === '0') return null;
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 0) return null;
	return Math.floor(n);
}

/** `null` = no app-level cap (disk / env still apply). */
export function maxUploadBytes(): number | null {
	return readMaxUploadBytes();
}

export function assertWithinUploadLimit(bytes: number): void {
	const max = maxUploadBytes();
	if (max !== null && bytes > max) {
		throw new Error(`File too large (max ${max} bytes)`);
	}
}
