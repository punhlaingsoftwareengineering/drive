<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { resolveHref } from '$lib/url/resolve-href';
	import { fetchWithSession } from '$lib/client/fetch-session';
	import { page } from '$app/state';
	import { downloadDriveFileAsBlob } from '$lib/client/drive-file';
	import { mapApiFile, type ApiDriveFile, type DriveItem } from '$lib/components/drive/drive-item';
	import { useDriveListLoader } from '$lib/components/drive/use-drive-list-loader.svelte';
	import DriveListStatus from '$lib/components/drive/drive-list-status.svelte';
	import DriveSharedTable from '$lib/components/drive/drive-shared-table.svelte';
	import { storageProviderLabel } from '$lib/model/storage-provider';
	import { toastService } from '$lib/service/toast.service.svelte';
	import { StatusColorEnum } from '$lib/model/enum/color.enum';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let rows = $state<DriveItem[]>([]);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let busyId = $state<string | null>(null);

	const team = $derived(data.teamView);
	const teamStorage = $derived(team?.storageProvider ?? 'local');
	const sharedBase = $derived(
		team ? resolveHref(`/home/team/${team.slug}/shared`) : resolve('/home/shared')
	);

	useDriveListLoader(loadShared);

	function enterFolder(item: DriveItem) {
		if (item.itemType !== 'folder' || !team) return;
		goto(`${sharedBase}?folder=${encodeURIComponent(item.id)}`);
	}

	async function loadShared() {
		if (!team) {
			rows = [];
			return;
		}
		loading = true;
		loadError = null;
		try {
			const folderId = page.url.searchParams.get('folder');
			const qs = new URLSearchParams({
				storageProvider: teamStorage,
				teamId: team.id
			});
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
		if (!cf) return sharedBase;
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
		Files and folders <strong>{team?.name ?? 'this team'}</strong> has shared with people outside the
		team. Open folders to browse; download when you have access.
	</p>

	<DriveListStatus {loading} hasRows={rows.length > 0} {loadError} />

	<div class="d-card flex min-h-0 flex-1 flex-col border border-base-300 bg-base-100 shadow-sm">
		<div class="d-card-body flex min-h-0 flex-1 flex-col p-0">
			<DriveSharedTable
				{rows}
				{loading}
				{busyId}
				currentFolder={data.currentFolder}
				{backFolderHref}
				emptyMessage="Nothing shared from {team?.name ?? 'this team'} on {storageProviderLabel(teamStorage)} yet."
				onEnterFolder={enterFolder}
				onDownload={(item) => void onDownloadItem(item)}
			/>
		</div>
	</div>
</div>
