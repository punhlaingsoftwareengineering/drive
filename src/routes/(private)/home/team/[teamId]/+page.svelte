<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { fetchWithSession } from '$lib/client/fetch-session';
	import { resolveHref } from '$lib/url/resolve-href';
	import { page } from '$app/state';
	import { uploadFilesWithProgress } from '$lib/client/upload-drive';
	import { mapApiFile, type ApiDriveFile, type DriveItem } from '$lib/components/drive/drive-item';
	import { createDriveFileActions } from '$lib/components/drive/use-drive-file-actions.svelte';
	import { useDriveListLoader } from '$lib/components/drive/use-drive-list-loader.svelte';
	import DriveListStatus from '$lib/components/drive/drive-list-status.svelte';
	import DriveBrowseTable from '$lib/components/drive/drive-browse-table.svelte';
	import DriveFileActionsMenu from '$lib/components/drive/drive-file-actions-menu.svelte';
	import DriveFileDialogs from '$lib/components/drive/drive-file-dialogs.svelte';
	import type { StorageProviderId } from '$lib/model/storage-provider';
	import { storageProviderLabel } from '$lib/model/storage-provider';
	import { bumpDriveListRefresh } from '$lib/state/drive-refresh.svelte';
	import { driveStorage } from '$lib/state/storage-provider.svelte';
	import { toastService } from '$lib/service/toast.service.svelte';
	import { StatusColorEnum } from '$lib/model/enum/color.enum';
	import type { PageProps } from './$types';
	import { onMount } from 'svelte';

	let { data }: PageProps = $props();

	let rows = $state<DriveItem[]>([]);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let fileDragDepth = $state(0);
	let dropUploading = $state(false);
	let dropProgress = $state(0);

	const actions = createDriveFileActions({
		menuElementId: 'team-file-actions-menu-float',
		buttonIdPrefix: 'team-file-actions-btn-',
		getRows: () => rows
	});

	onMount(() => actions.attachMenuListeners());
	useDriveListLoader(loadFiles);

	const teamBase = $derived(
		data.teamView ? resolve(`/home/team/${data.teamView.id}`) : resolve('/home')
	);

	function teamStorage(): StorageProviderId {
		return data.teamView?.storageProvider ?? driveStorage.current;
	}

	function enterFolder(item: DriveItem) {
		if (item.itemType !== 'folder') return;
		goto(`${teamBase}?folder=${encodeURIComponent(item.id)}`);
	}

	async function loadFiles() {
		loading = true;
		loadError = null;
		try {
			if (!data.teamView) {
				rows = [];
				return;
			}
			const folderId = page.url.searchParams.get('folder');
			const qs = new URLSearchParams({ storageProvider: teamStorage() });
			qs.set('teamId', data.teamView.id);
			if (folderId) qs.set('parentId', folderId);
			const r = await fetchWithSession(`${resolveHref('/api/drive/files')}?${qs}`);
			if (!r.ok) throw new Error((await r.text()) || r.statusText);
			const payload = (await r.json()) as { files: ApiDriveFile[] };
			rows = payload.files.map(mapApiFile);
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load files';
			rows = [];
		} finally {
			loading = false;
		}
	}

	const backFolderHref = $derived.by(() => {
		const cf = data.currentFolder;
		if (!cf) return teamBase;
		return cf.upHref;
	});

	const emptyLabel = $derived(storageProviderLabel(teamStorage()));

	async function uploadDroppedFiles(fileList: File[]) {
		if (!fileList.length || !data.teamView) return;
		dropUploading = true;
		dropProgress = 0;
		try {
			const parentId = page.url.searchParams.get('folder') ?? data.teamView.rootFolderId;
			await uploadFilesWithProgress(
				fileList,
				teamStorage(),
				(loaded, total) => {
					dropProgress = total ? Math.round((100 * loaded) / total) : 0;
				},
				parentId,
				data.teamView.id
			);
			bumpDriveListRefresh();
			toastService.addToast(`Uploaded ${fileList.length} file(s)`, StatusColorEnum.SUCCESS);
		} catch (err) {
			toastService.addToast(
				err instanceof Error ? err.message : 'Upload failed',
				StatusColorEnum.ERROR
			);
		} finally {
			dropUploading = false;
			dropProgress = 0;
			fileDragDepth = 0;
		}
	}

	function onDropCard(e: DragEvent) {
		e.preventDefault();
		const dt = e.dataTransfer;
		if (!dt?.files?.length) return;
		void uploadDroppedFiles(Array.from(dt.files));
	}

	function onCardDragEnter(e: DragEvent) {
		if (e.dataTransfer?.types.includes('Files')) {
			e.preventDefault();
			fileDragDepth += 1;
		}
	}

	function onCardDragLeave(e: DragEvent) {
		if (e.dataTransfer?.types.includes('Files')) {
			fileDragDepth = Math.max(0, fileDragDepth - 1);
		}
	}
</script>

<div class="flex min-h-0 flex-1 flex-col gap-6 pb-8">
	<p class="shrink-0 text-sm text-base-content/70">
		Team drive for <strong>{data.teamView?.name ?? 'team'}</strong>. Drag files here or use
		<strong>NEW</strong> to upload into this team's storage ({emptyLabel}).
	</p>

	<DriveListStatus {loading} hasRows={rows.length > 0} {loadError} />

	{#if dropUploading}
		<div class="d-alert d-alert-info">
			<span>Uploading… {dropProgress}%</span>
			<progress class="d-progress mt-2 w-full d-progress-info" value={dropProgress} max="100"
			></progress>
		</div>
	{/if}

	<div
		class="d-card flex min-h-0 flex-1 flex-col border border-base-300 bg-base-100 shadow-sm transition-colors {fileDragDepth >
		0
			? 'border-info/50 bg-info/5'
			: ''}"
		role="region"
		aria-label="Team files"
		ondragenter={onCardDragEnter}
		ondragleave={onCardDragLeave}
		ondragover={(e) => {
			if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
		}}
		ondrop={onDropCard}
	>
		<div class="d-card-body flex min-h-0 flex-1 flex-col p-0">
			<DriveBrowseTable
				{rows}
				{loading}
				{actions}
				buttonIdPrefix="team-file-actions-btn-"
				currentFolder={data.currentFolder}
				{backFolderHref}
				breadcrumbLabel="Team files"
				emptyMessage="No files for {emptyLabel} yet. Use NEW or drag files here."
				onEnterFolder={enterFolder}
				onScroll={actions.closeFileActionsMenu}
			/>
		</div>
	</div>
</div>

<DriveFileActionsMenu {actions} menuElementId="team-file-actions-menu-float" />
<DriveFileDialogs {actions} />
