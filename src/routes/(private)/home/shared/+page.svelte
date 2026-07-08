<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { fetchWithSession } from '$lib/client/fetch-session';
	import { resolveHref } from '$lib/url/resolve-href';
	import { page } from '$app/state';
	import { downloadDriveFileAsBlob } from '$lib/client/drive-file';
	import { mapApiFile, type ApiDriveFile, type DriveItem } from '$lib/components/drive/drive-item';
	import { createDriveSelection } from '$lib/components/drive/use-drive-selection.svelte';
	import { createDriveBulkActions } from '$lib/components/drive/use-drive-bulk-actions.svelte';
	import { useDriveListLoader } from '$lib/components/drive/use-drive-list-loader.svelte';
	import DriveListStatus from '$lib/components/drive/drive-list-status.svelte';
	import DriveSharedTable from '$lib/components/drive/drive-shared-table.svelte';
	import DriveSelectionBar from '$lib/components/drive/drive-selection-bar.svelte';
	import { storageProviderLabel } from '$lib/model/storage-provider';
	import { driveStorage } from '$lib/state/storage-provider.svelte';
	import { toastService } from '$lib/service/toast.service.svelte';
	import { StatusColorEnum } from '$lib/model/enum/color.enum';
	import type { PageProps } from './$types';
	import { onMount } from 'svelte';

	let { data }: PageProps = $props();

	let rows = $state<DriveItem[]>([]);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let busyId = $state<string | null>(null);

	const selection = createDriveSelection();
	const bulk = createDriveBulkActions({
		selection,
		getRows: () => rows,
		canEditItem: () => false,
		storageProvider: () => driveStorage.current
	});

	onMount(() => selection.attachEscapeListener());
	useDriveListLoader(loadShared);

	function enterFolder(item: DriveItem) {
		if (item.itemType !== 'folder') return;
		goto(`${resolve('/home/shared')}?folder=${encodeURIComponent(item.id)}`);
	}

	async function loadShared() {
		selection.clear();
		loading = true;
		loadError = null;
		try {
			const folderId = page.url.searchParams.get('folder');
			const qs = new URLSearchParams({ storageProvider: driveStorage.current });
			if (folderId) qs.set('folder', folderId);
			const r = await fetchWithSession(`${resolveHref('/api/drive/shared')}?${qs}`);
			if (!r.ok) throw new Error((await r.text()) || r.statusText);
			const payload = (await r.json()) as { files: ApiDriveFile[] };
			rows = payload.files.map(mapApiFile);
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load shared items';
			rows = [];
		} finally {
			loading = false;
		}
	}

	const backFolderHref = $derived.by(() => {
		const cf = data.currentFolder;
		if (!cf) return resolve('/home/shared');
		return cf.upHref;
	});

	async function onDownloadItem(item: DriveItem) {
		busyId = item.id;
		try {
			const fallback = item.itemType === 'folder' ? `${item.name}.zip` : item.name;
			await downloadDriveFileAsBlob(item.id, fallback);
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Download failed',
				StatusColorEnum.ERROR
			);
		} finally {
			busyId = null;
		}
	}
</script>

<div class="flex min-h-0 flex-1 flex-col gap-6 pb-8">
	<p class="shrink-0 text-sm text-base-content/70">
		Files and folders others shared with your account appear here. Open folders to browse what you
		can access; download files or folders (as ZIP) when you have access.
	</p>

	<DriveListStatus {loading} hasRows={rows.length > 0} {loadError} />

	<div class="d-card flex min-h-0 flex-1 flex-col border border-base-300 bg-base-100 shadow-sm">
		<div class="d-card-body flex min-h-0 flex-1 flex-col p-0">
			<DriveSelectionBar
				count={selection.count}
				busy={bulk.busy}
				showDownload
				onClear={() => selection.clear()}
				onDownload={() => void bulk.bulkDownload()}
			/>
			<DriveSharedTable
				{rows}
				{loading}
				{busyId}
				{selection}
				currentFolder={data.currentFolder}
				{backFolderHref}
				emptyMessage="Nothing shared for {storageProviderLabel(driveStorage.current)} yet."
				onEnterFolder={enterFolder}
				onDownload={(item) => void onDownloadItem(item)}
			/>
		</div>
	</div>
</div>
