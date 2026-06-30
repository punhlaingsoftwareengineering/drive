<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { fetchWithSession } from '$lib/client/fetch-session';
	import { resolveHref } from '$lib/url/resolve-href';
	import { downloadDriveFileAsBlob } from '$lib/client/drive-file';
	import {
		canEditRecentItem,
		type RecentDriveItem,
		type RecentSource
	} from '$lib/components/drive/drive-item';
	import { createDriveFileActions } from '$lib/components/drive/use-drive-file-actions.svelte';
	import { useDriveListLoader } from '$lib/components/drive/use-drive-list-loader.svelte';
	import DriveListStatus from '$lib/components/drive/drive-list-status.svelte';
	import DriveRecentTable from '$lib/components/drive/drive-recent-table.svelte';
	import DriveFileActionsMenu from '$lib/components/drive/drive-file-actions-menu.svelte';
	import DriveFileDialogs from '$lib/components/drive/drive-file-dialogs.svelte';
	import { storageProviderLabel } from '$lib/model/storage-provider';
	import { driveStorage } from '$lib/state/storage-provider.svelte';
	import { toastService } from '$lib/service/toast.service.svelte';
	import { StatusColorEnum } from '$lib/model/enum/color.enum';
	import type { FileLabelColorId } from '$lib/model/file-label-color';
	import type { StorageProviderId } from '$lib/model/storage-provider';
	import { onMount } from 'svelte';

	type ApiRecentFile = {
		id: string;
		name: string;
		itemType: string;
		sizeBytes: number;
		updatedAt: string;
		recencyAt: string;
		storageProvider: StorageProviderId;
		isPinned: boolean;
		isStarred: boolean;
		color: string | null;
		parentId: string | null;
		ownerName: string;
		source: RecentSource;
		teamId: string | null;
		teamName: string | null;
		sharePermission: string | null;
	};

	let rows = $state<RecentDriveItem[]>([]);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let busyId = $state<string | null>(null);

	const actions = createDriveFileActions({
		menuElementId: 'recent-file-actions-menu-float',
		buttonIdPrefix: 'recent-file-actions-btn-',
		getRows: () => rows,
		canEditItem: (item) => canEditRecentItem(item as RecentDriveItem)
	});

	onMount(() => actions.attachMenuListeners());
	useDriveListLoader(loadRecent);

	function mapRecentRow(f: ApiRecentFile): RecentDriveItem {
		return {
			id: f.id,
			name: f.name,
			itemType: f.itemType === 'folder' ? 'folder' : 'file',
			sizeBytes: f.sizeBytes,
			updatedAt: f.updatedAt.slice(0, 10),
			recencyAt: f.recencyAt.slice(0, 10),
			storageProvider: f.storageProvider,
			pinned: f.isPinned,
			starred: f.isStarred,
			color: f.color as FileLabelColorId | null,
			parentId: f.parentId ?? null,
			ownerName: f.ownerName,
			source: f.source,
			teamId: f.teamId,
			teamName: f.teamName,
			sharePermission: f.sharePermission
		};
	}

	function enterFolder(item: RecentDriveItem) {
		if (item.itemType !== 'folder') return;
		if (item.source === 'own') {
			void goto(`${resolve('/home')}?folder=${encodeURIComponent(item.id)}`);
		} else if (item.source === 'shared') {
			void goto(`${resolve('/home/shared')}?folder=${encodeURIComponent(item.id)}`);
		} else if (item.source === 'team' && item.teamId) {
			void goto(`${resolve(`/home/team/${item.teamId}`)}?folder=${encodeURIComponent(item.id)}`);
		}
	}

	async function loadRecent() {
		loading = true;
		loadError = null;
		try {
			const qs = new URLSearchParams({ storageProvider: driveStorage.current });
			const r = await fetchWithSession(`${resolveHref('/api/drive/recent')}?${qs}`);
			if (!r.ok) throw new Error((await r.text()) || r.statusText);
			const payload = (await r.json()) as { files: ApiRecentFile[] };
			rows = payload.files.map(mapRecentRow);
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load recent';
			rows = [];
		} finally {
			loading = false;
		}
	}

	async function onDownloadShared(item: RecentDriveItem) {
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
		Items from your home drive, things shared with you, and team drives — ordered by recency.
		Filtered by the storage provider in the header.
	</p>

	<DriveListStatus {loading} hasRows={rows.length > 0} {loadError} />

	<div
		class="d-card flex min-h-0 flex-1 flex-col border border-base-300 bg-base-100 shadow-sm"
		role="region"
		aria-label="Recent files"
	>
		<div class="d-card-body flex min-h-0 flex-1 flex-col p-0">
			<DriveRecentTable
				{rows}
				{loading}
				storageLabel={storageProviderLabel(driveStorage.current)}
				{actions}
				buttonIdPrefix="recent-file-actions-btn-"
				emptyMessage="No files or folders for this storage yet."
				onEnterFolder={enterFolder}
				onDownloadShared={(item) => void onDownloadShared(item)}
				onScroll={actions.closeFileActionsMenu}
			/>
		</div>
	</div>
</div>

<DriveFileActionsMenu {actions} menuElementId="recent-file-actions-menu-float" />
<DriveFileDialogs {actions} />
