<script lang="ts">
	import { fetchWithSession } from '$lib/client/fetch-session';
	import { resolveHref } from '$lib/url/resolve-href';
	import {
		patchDriveFile,
		permanentDeleteDriveFile,
		type PatchDriveFileBody
	} from '$lib/client/drive-file';
	import {
		mapApiFile,
		type ApiDriveFile,
		type TrashDriveItem
	} from '$lib/components/drive/drive-item';
	import { useDriveListLoader } from '$lib/components/drive/use-drive-list-loader.svelte';
	import DriveListStatus from '$lib/components/drive/drive-list-status.svelte';
	import DriveTrashTable from '$lib/components/drive/drive-trash-table.svelte';
	import { storageProviderLabel } from '$lib/model/storage-provider';
	import { bumpDriveListRefresh } from '$lib/state/drive-refresh.svelte';
	import { driveStorage } from '$lib/state/storage-provider.svelte';
	import { toastService } from '$lib/service/toast.service.svelte';
	import { StatusColorEnum } from '$lib/model/enum/color.enum';
	import type { FileLabelColorId } from '$lib/model/file-label-color';

	type ApiTrashRow = ApiDriveFile & { trashedAt: string; purgeAt: string };

	let rows = $state<TrashDriveItem[]>([]);
	let trashRetentionDays = $state(30);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let busyId = $state<string | null>(null);

	useDriveListLoader(loadTrash);

	function mapTrashRow(f: ApiTrashRow): TrashDriveItem {
		return {
			...mapApiFile(f),
			trashedAt: f.trashedAt.slice(0, 10),
			purgeAt: f.purgeAt,
			color: f.color as FileLabelColorId | null
		};
	}

	function daysUntilPurge(purgeIso: string): number {
		const end = new Date(purgeIso).getTime();
		return Math.max(0, Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000)));
	}

	function purgeLabel(purgeIso: string): string {
		const d = daysUntilPurge(purgeIso);
		if (d === 0) return 'Removes today';
		if (d === 1) return 'Removes in 1 day';
		return `Removes in ${d} days`;
	}

	async function loadTrash() {
		loading = true;
		loadError = null;
		try {
			const qs = new URLSearchParams({ storageProvider: driveStorage.current });
			const r = await fetchWithSession(`${resolveHref('/api/drive/trash')}?${qs}`);
			if (!r.ok) throw new Error((await r.text()) || r.statusText);
			const payload = (await r.json()) as { files: ApiTrashRow[]; trashRetentionDays?: number };
			if (typeof payload.trashRetentionDays === 'number') {
				trashRetentionDays = payload.trashRetentionDays;
			}
			rows = payload.files.map(mapTrashRow);
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load trash';
			rows = [];
		} finally {
			loading = false;
		}
	}

	async function runPatch(id: string, body: PatchDriveFileBody, successMsg?: string) {
		busyId = id;
		try {
			await patchDriveFile(id, body);
			bumpDriveListRefresh();
			if (successMsg) toastService.addToast(successMsg, StatusColorEnum.SUCCESS);
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Update failed',
				StatusColorEnum.ERROR
			);
		} finally {
			busyId = null;
		}
	}

	async function onRestore(item: TrashDriveItem) {
		busyId = item.id;
		try {
			await patchDriveFile(item.id, { trashed: false });
			bumpDriveListRefresh();
			toastService.addToast('Restored to your drive', StatusColorEnum.SUCCESS);
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Restore failed',
				StatusColorEnum.ERROR
			);
		} finally {
			busyId = null;
		}
	}

	async function onDeleteForever(item: TrashDriveItem) {
		if (
			!confirm(
				`Permanently delete “${item.name}”${item.itemType === 'folder' ? ' and everything inside it' : ''}? This cannot be undone.`
			)
		) {
			return;
		}
		busyId = item.id;
		try {
			await permanentDeleteDriveFile(item.id);
			bumpDriveListRefresh();
			toastService.addToast('Permanently deleted', StatusColorEnum.SUCCESS);
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Permanent delete failed',
				StatusColorEnum.ERROR
			);
		} finally {
			busyId = null;
		}
	}
</script>

<div class="flex min-h-0 flex-1 flex-col gap-6 pb-8">
	<div class="d-alert shrink-0 d-alert-warning shadow-sm">
		<div class="flex flex-col gap-1">
			<span class="font-semibold">Trash retention</span>
			<span class="text-sm">
				Items stay here for <strong>{trashRetentionDays} days</strong>, then are removed
				automatically. Restore anything you still need, or delete it forever now.
			</span>
		</div>
	</div>

	<p class="shrink-0 text-sm text-base-content/70">
		List matches the storage provider in the header. Restored items return to their original
		location. Permanent deletion frees storage immediately.
	</p>

	<DriveListStatus {loading} hasRows={rows.length > 0} {loadError} />

	<div class="d-card flex min-h-0 flex-1 flex-col border border-base-300 bg-base-100 shadow-sm">
		<div class="d-card-body flex min-h-0 flex-1 flex-col p-0">
			<DriveTrashTable
				{rows}
				{loading}
				{busyId}
				{purgeLabel}
				emptyMessage="Trash is empty for {storageProviderLabel(driveStorage.current)}."
				onTogglePin={(item) =>
					void runPatch(item.id, { isPinned: !item.pinned }, item.pinned ? 'Unpinned' : 'Pinned')}
				onToggleStar={(item) =>
					void runPatch(
						item.id,
						{ isStarred: !item.starred },
						item.starred ? 'Unstarred' : 'Starred'
					)}
				onRestore={(item) => void onRestore(item)}
				onDeleteForever={(item) => void onDeleteForever(item)}
			/>
		</div>
	</div>
</div>
