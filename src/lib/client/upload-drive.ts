import { UPLOAD_CHUNK_BYTES } from '$lib/upload/chunk-bytes';
import { resolve as resolveAppPath } from '$app/paths';
import { redirectToLoginSessionExpired } from '$lib/client/fetch-session';
import type { StorageProviderId } from '$lib/model/storage-provider';

/** Use chunked binary upload above this size (bytes). */
export { UPLOAD_CHUNK_BYTES };

function uploadQuery(params: Record<string, string | number | undefined | null>): string {
	const qs = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null || value === '') continue;
		qs.set(key, String(value));
	}
	const encoded = qs.toString();
	return encoded ? `?${encoded}` : '';
}

function uploadErrorMessage(status: number, responseText: string): string {
	if (!responseText.trim()) return `Upload failed (${status})`;
	try {
		const parsed = JSON.parse(responseText) as { message?: string };
		if (typeof parsed.message === 'string' && parsed.message.trim()) {
			return parsed.message;
		}
	} catch {
		// not JSON
	}
	return responseText;
}

function postBinary(
	pathWithQuery: string,
	body: Blob,
	onProgress: (loaded: number, total: number) => void
): Promise<string> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.upload.addEventListener('progress', (e) => {
			if (e.lengthComputable) onProgress(e.loaded, e.total);
		});
		xhr.addEventListener('load', () => {
			if (xhr.status === 401) {
				redirectToLoginSessionExpired();
				reject(new Error('Session expired. Sign in again.'));
				return;
			}
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve(xhr.responseText || '{}');
				return;
			}
			reject(new Error(uploadErrorMessage(xhr.status, xhr.responseText)));
		});
		xhr.addEventListener('error', () => reject(new Error('Network error')));
		xhr.open('POST', resolveAppPath(pathWithQuery));
		xhr.withCredentials = true;
		xhr.setRequestHeader('Content-Type', 'application/octet-stream');
		xhr.setRequestHeader('Accept', 'application/json');
		xhr.send(body);
	});
}

function postChunk(
	query: Record<string, string | number | undefined | null>,
	chunk: Blob,
	onPartProgress: (loaded: number, total: number) => void,
	fileTotal: number,
	loadedSoFar: number
): Promise<{
	uploadId?: string;
	done?: boolean;
	ok?: boolean;
	created?: { id: string; name: string }[];
}> {
	return postBinary(
		`/api/drive/upload/chunk${uploadQuery(query)}`,
		chunk,
		(loaded, total) => onPartProgress(loadedSoFar + loaded, fileTotal)
	).then((text) => {
		try {
			return JSON.parse(text) as {
				uploadId?: string;
				done?: boolean;
				ok?: boolean;
				created?: { id: string; name: string }[];
			};
		} catch {
			return {};
		}
	});
}

async function uploadOneFileChunked(
	file: File,
	storageProvider: StorageProviderId,
	parentFolderId: string | null | undefined,
	onProgress: (loaded: number, total: number) => void,
	teamId?: string | null
): Promise<void> {
	const chunkCount = Math.max(1, Math.ceil(file.size / UPLOAD_CHUNK_BYTES));
	let uploadId: string | undefined;
	let loaded = 0;

	for (let i = 0; i < chunkCount; i++) {
		const start = i * UPLOAD_CHUNK_BYTES;
		const end = Math.min(start + UPLOAD_CHUNK_BYTES, file.size);
		const slice = file.slice(start, end);

		const query: Record<string, string | number | undefined | null> = {
			chunkIndex: i,
			chunkCount,
			uploadId,
			storageProvider: i === 0 ? storageProvider : undefined,
			fileName: i === 0 ? file.name : undefined,
			mimeType: i === 0 ? file.type || 'application/octet-stream' : undefined,
			parentId: i === 0 ? parentFolderId : undefined,
			teamId: i === 0 ? teamId : undefined
		};

		const res = await postChunk(query, slice, onProgress, file.size, loaded);
		if (res.uploadId) uploadId = res.uploadId;
		loaded += end - start;
		onProgress(loaded, file.size);
		if (res.done && res.ok) return;
	}

	throw new Error('Chunk upload did not complete');
}

/**
 * Binary upload with progress. Large files are sent in 8 MiB chunks to `/api/drive/upload/chunk`.
 * Uses `application/octet-stream` (not multipart) to avoid SvelteKit CSRF origin checks on LAN HTTP.
 */
export function uploadFilesWithProgress(
	files: File[],
	storageProvider: StorageProviderId,
	onProgress: (loaded: number, total: number) => void,
	parentFolderId?: string | null,
	teamId?: string | null
): Promise<{ ok: boolean }> {
	return new Promise((resolve, reject) => {
		const totalBytes = files.reduce((s, f) => s + f.size, 0);
		let doneBytes = 0;

		const run = async () => {
			for (const file of files) {
				if (file.size > UPLOAD_CHUNK_BYTES) {
					await uploadOneFileChunked(
						file,
						storageProvider,
						parentFolderId ?? undefined,
						(loaded, total) => {
							onProgress(doneBytes + loaded, totalBytes);
						},
						teamId
					);
					doneBytes += file.size;
					onProgress(doneBytes, totalBytes);
				} else {
					await postBinary(
						`/api/drive/upload${uploadQuery({
							storageProvider,
							parentId: parentFolderId,
							teamId,
							fileName: file.name,
							mimeType: file.type || 'application/octet-stream'
						})}`,
						file,
						(loaded, total) => onProgress(doneBytes + loaded, totalBytes)
					);
					doneBytes += file.size;
					onProgress(doneBytes, totalBytes);
				}
			}
			resolve({ ok: true });
		};

		void run().catch(reject);
	});
}
