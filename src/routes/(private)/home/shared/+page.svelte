<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { fetchWithSession } from '$lib/client/fetch-session';
	import { resolveHref } from '$lib/url/resolve-href';
	import { page } from '$app/state';
	import { downloadDriveFileAsBlob } from '$lib/client/drive-file';
	import {
		fileLabelBorderClass,
		fileLabelIconClass,
		type FileLabelColorId
	} from '$lib/model/file-label-color';
	import type { StorageProviderId } from '$lib/model/storage-provider';
	import { storageProviderLabel } from '$lib/model/storage-provider';
	import { StatusColorEnum } from '$lib/model/enum/color.enum';
	import { registerDriveListReload } from '$lib/state/drive-refresh.svelte';
	import { driveStorage } from '$lib/state/storage-provider.svelte';
	import { toastService } from '$lib/service/toast.service.svelte';
	import { formatBytes } from '$lib/tool/format-bytes';
	import type { PageProps } from './$types';
	import {
		LucideArrowLeft,
		LucideDownload,
	import AppMarkIcon from '$lib/components/app-mark-icon.svelte';
		LucideFolder,
		LucideLink,
		LucidePin,
		LucideStar
	} from '@lucide/svelte';
	import { onMount } from 'svelte';

	let { data }: PageProps = $props();

	type ApiFile = {
		id: string;
		name: string;
		itemType: string;
		sizeBytes: number;
		updatedAt: string;
		storageProvider: StorageProviderId;
		isPinned: boolean;
		isStarred: boolean;
		color: string | null;
		parentId: string | null;
		ownerName: string;
		sharePermission?: string;
	};

	type DriveItem = {
		id: string;
		name: string;
		itemType: 'file' | 'folder';
		sizeBytes: number | null;
		updatedAt: string;
		storageProvider: StorageProviderId;
		pinned: boolean;
		starred: boolean;
		color: FileLabelColorId | string | null;
		parentId: string | null;
		ownerName: string;
	};

	let rows = $state<DriveItem[]>([]);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let busyId = $state<string | null>(null);

	function mapRow(f: ApiFile): DriveItem {
		return {
			id: f.id,
			name: f.name,
			itemType: f.itemType === 'folder' ? 'folder' : 'file',
			sizeBytes: f.sizeBytes,
			updatedAt: f.updatedAt.slice(0, 10),
			storageProvider: f.storageProvider,
			pinned: f.isPinned,
			starred: f.isStarred,
			color: f.color as FileLabelColorId | null,
			parentId: f.parentId ?? null,
			ownerName: f.ownerName
		};
	}

	function enterFolder(item: DriveItem) {
		if (item.itemType !== 'folder') return;
		goto(`${resolve('/home/shared')}?folder=${encodeURIComponent(item.id)}`);
	}

	async function loadShared() {
		loading = true;
		loadError = null;
		try {
			const folderId = page.url.searchParams.get('folder');
			const qs = new URLSearchParams({
				storageProvider: driveStorage.current
			});
			if (folderId) qs.set('folder', folderId);
			const r = await fetchWithSession(`${resolveHref('/api/drive/shared')}?${qs}`);
			if (!r.ok) {
				const t = await r.text();
				throw new Error(t || r.statusText);
			}
			const payload = (await r.json()) as { files: ApiFile[] };
			rows = payload.files.map(mapRow);
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load shared items';
			rows = [];
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void loadShared();
		return registerDriveListReload(() => void loadShared());
	});

	afterNavigate(() => {
		if (browser) void loadShared();
	});

	const partitionedShared = $derived.by(() => {
		const sorted = rows.slice().sort((a, b) => a.name.localeCompare(b.name));
		const pinned: DriveItem[] = [];
		const starred: DriveItem[] = [];
		const other: DriveItem[] = [];
		for (const r of sorted) {
			if (r.pinned) pinned.push(r);
			else if (r.starred) starred.push(r);
			else other.push(r);
		}
		return { pinned, starred, other };
	});

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
		can access; download files or folders (as ZIP) when you have access. Storage column shows where
		the owner stored the item.
	</p>

	{#if loading && rows.length === 0}
		<div class="h-40 w-full d-skeleton"></div>
	{:else if loadError}
		<div class="d-alert d-alert-error">
			<span>{loadError}</span>
		</div>
	{/if}

	<div class="d-card flex min-h-0 flex-1 flex-col border border-base-300 bg-base-100 shadow-sm">
		<div class="d-card-body flex min-h-0 flex-1 flex-col p-0">
			<div class="min-h-0 flex-1 overflow-auto">
				<table class="d-table w-full min-w-[52rem] d-table-zebra">
					<thead>
						<tr class="border-b border-base-300">
							<th class="min-w-[14rem]">Name</th>
							<th class="w-28">Size</th>
							<th class="w-36">Modified</th>
							<th class="w-32">Storage</th>
							<th class="min-w-[8rem]">Owner</th>
							<th class="w-24 text-center">Pin</th>
							<th class="w-24 text-center">Star</th>
							<th class="w-40 text-center">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#snippet sharedRow(item: DriveItem)}
							<tr
								class="border-l-4 transition-colors hover:bg-info/50 {fileLabelBorderClass(
									item.color
								)}"
							>
								<td>
									{#if item.itemType === 'folder'}
										<button
											type="button"
											class="inline-flex max-w-full min-w-0 items-center gap-2 text-left font-medium hover:underline"
											onclick={() => enterFolder(item)}
										>
											<LucideFolder
												class="size-5 shrink-0 {fileLabelIconClass(item.color)}"
												aria-hidden="true"
											/>
											<span class="truncate">{item.name}</span>
										</button>
									{:else}
										<span class="inline-flex max-w-full min-w-0 items-center gap-2">
											<AppMarkIcon
												class="size-5 shrink-0 {fileLabelIconClass(item.color ?? 'base')}"
											/>
											<span class="truncate font-medium">{item.name}</span>
										</span>
									{/if}
								</td>
								<td class="text-base-content/80 tabular-nums">{formatBytes(item.sizeBytes)}</td>
								<td class="text-base-content/80">{item.updatedAt}</td>
								<td class="text-sm">{storageProviderLabel(item.storageProvider)}</td>
								<td
									class="max-w-[10rem] truncate text-sm text-base-content/80"
									title={item.ownerName}
								>
									{item.ownerName}
								</td>
								<td class="text-center">
									<span
										class="inline-flex justify-center"
										title={item.pinned ? 'Pinned by owner' : 'Not pinned'}
										aria-hidden="true"
									>
										<LucidePin
											class="size-4 {item.pinned ? 'text-primary' : 'text-base-content/15'}"
										/>
									</span>
								</td>
								<td class="text-center">
									<span
										class="inline-flex justify-center"
										title={item.starred ? 'Starred by owner' : 'Not starred'}
										aria-hidden="true"
									>
										<LucideStar
											class="size-4 {item.starred
												? 'fill-warning text-warning'
												: 'text-base-content/15'}"
										/>
									</span>
								</td>
								<td class="text-center">
									<div class="flex items-center justify-center gap-1">
										<button
											type="button"
											class="d-btn d-btn-square d-btn-ghost d-btn-sm"
											aria-label={item.itemType === 'folder'
												? `Download ${item.name} as ZIP`
												: `Download ${item.name}`}
											disabled={busyId === item.id}
											onclick={() => void onDownloadItem(item)}
										>
											<LucideDownload class="size-4" />
										</button>
										<div
											class="d-tooltip d-tooltip-top"
											data-tip="Only the owner can create a public link"
										>
											<button
												type="button"
												class="d-btn d-btn-square d-btn-ghost d-btn-sm"
												aria-label="Copy public link"
												disabled
											>
												<LucideLink class="size-4" />
											</button>
										</div>
									</div>
								</td>
							</tr>
						{/snippet}
						<tr class="bg-base-200/60 hover:bg-base-200/60">
							<td colspan="8" class="py-2 text-xs font-semibold tracking-wide uppercase">
								{#if data.currentFolder}
									<a
										href={backFolderHref}
										class="inline-flex max-w-full min-w-0 items-center gap-2 text-base-content/80 normal-case no-underline hover:text-base-content hover:underline"
										aria-label="Back out of {data.currentFolder.name}"
									>
										<LucideArrowLeft class="size-3.5 shrink-0" aria-hidden="true" />
										<span class="truncate font-medium">{data.currentFolder.name}</span>
									</a>
								{:else}
									<span class="text-base-content/80">Shared with you</span>
								{/if}
							</td>
						</tr>
						{#if rows.length === 0 && !loading}
							<tr>
								<td colspan="8" class="py-8 text-center text-base-content/60">
									Nothing shared for {storageProviderLabel(driveStorage.current)} yet.
								</td>
							</tr>
						{:else}
							{#if partitionedShared.pinned.length > 0}
								<tr class="bg-base-200/60 hover:bg-base-200/60">
									<td
										colspan="8"
										class="py-2 text-xs font-semibold tracking-wide text-base-content/80 uppercase"
									>
										<span class="inline-flex items-center gap-2">
											<LucidePin class="size-3.5" aria-hidden="true" />
											Pinned
										</span>
									</td>
								</tr>
								{#each partitionedShared.pinned as item (item.id)}
									{@render sharedRow(item)}
								{/each}
							{/if}
							{#if partitionedShared.starred.length > 0}
								<tr class="bg-base-200/60 hover:bg-base-200/60">
									<td
										colspan="8"
										class="py-2 text-xs font-semibold tracking-wide text-base-content/80 uppercase"
									>
										<span class="inline-flex items-center gap-2">
											<LucideStar class="size-3.5" aria-hidden="true" />
											Starred
										</span>
									</td>
								</tr>
								{#each partitionedShared.starred as item (item.id)}
									{@render sharedRow(item)}
								{/each}
							{/if}
							{#if partitionedShared.other.length > 0}
								{#if partitionedShared.pinned.length > 0 || partitionedShared.starred.length > 0}
									<tr class="bg-base-200/60 hover:bg-base-200/60">
										<td
											colspan="8"
											class="py-2 text-xs font-semibold tracking-wide text-base-content/80 uppercase"
										>
											More
										</td>
									</tr>
								{/if}
								{#each partitionedShared.other as item (item.id)}
									{@render sharedRow(item)}
								{/each}
							{/if}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>
