import { fetchWithSession } from '$lib/client/fetch-session';
import { resolveHref } from '$lib/url/resolve-href';
import type { PatchDriveFileBody } from '$lib/client/drive-file';
import type { StorageProviderId } from '$lib/model/storage-provider';

export type BatchPatchResult = {
	ok: boolean;
	failed: { id: string; reason: string }[];
};

export async function batchPatchDriveFiles(
	ids: string[],
	patch: PatchDriveFileBody
): Promise<BatchPatchResult> {
	const r = await fetchWithSession(resolveHref('/api/drive/files/batch'), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ ids, patch })
	});
	if (!r.ok) {
		const t = await r.text();
		throw new Error(t || `Batch update failed (${r.status})`);
	}
	return (await r.json()) as BatchPatchResult;
}

export type MoveDriveItemsParams = {
	ids: string[];
	parentId: string | null;
	teamId?: string;
	storageProvider: StorageProviderId;
};

export type MoveDriveItemsResult = {
	ok: boolean;
	failed: { id: string; reason: string }[];
};

export async function moveDriveItems(params: MoveDriveItemsParams): Promise<MoveDriveItemsResult> {
	const r = await fetchWithSession(resolveHref('/api/drive/files/move'), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(params)
	});
	if (!r.ok) {
		const t = await r.text();
		throw new Error(t || `Move failed (${r.status})`);
	}
	return (await r.json()) as MoveDriveItemsResult;
}
