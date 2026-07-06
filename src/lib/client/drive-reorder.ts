import { fetchWithSession } from '$lib/client/fetch-session';
import { resolveHref } from '$lib/url/resolve-href';
import { resolve } from '$app/paths';
import type { DriveItem } from '$lib/components/drive/drive-item';
import type { StorageProviderId } from '$lib/model/storage-provider';

export async function reorderDriveItems(params: {
	orderedIds: string[];
	parentId: string | null;
	storageProvider: StorageProviderId;
	teamId?: string | null;
}): Promise<void> {
	const r = await fetchWithSession(resolveHref('/api/drive/files/reorder'), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			orderedIds: params.orderedIds,
			parentId: params.parentId,
			storageProvider: params.storageProvider,
			...(params.teamId ? { teamId: params.teamId } : {})
		})
	});
	if (!r.ok) throw new Error((await r.text()) || r.statusText);
}

export function applyLocalReorder(rows: DriveItem[], orderedIds: string[]): DriveItem[] {
	const byId = new Map(rows.map((r) => [r.id, r]));
	const reordered = orderedIds.map((id, i) => {
		const row = byId.get(id);
		if (!row) throw new Error('Missing row');
		return { ...row, sortOrder: i };
	});
	const rest = rows.filter((r) => !orderedIds.includes(r.id));
	return [...reordered, ...rest];
}
