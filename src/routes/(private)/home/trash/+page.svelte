<script lang="ts">
	import { resolve } from '$app/paths';
	import { fetchWithSession } from '$lib/client/fetch-session';
	import { resolveHref } from '$lib/url/resolve-href';
	import {
		patchDriveFile,
		permanentDeleteDriveFile,
		type PatchDriveFileBody
	} from '$lib/client/drive-file';
	import {
		fileLabelBorderClass,
		fileLabelIconClass,
		type FileLabelColorId
	} from '$lib/model/file-label-color';
	import type { StorageProviderId } from '$lib/model/storage-provider';
	import { storageProviderLabel } from '$lib/model/storage-provider';
	import { StatusColorEnum } from '$lib/model/enum/color.enum';
	import { bumpDriveListRefresh, registerDriveListReload } from '$lib/state/drive-refresh.svelte';
	import { driveStorage } from '$lib/state/storage-provider.svelte';
	import { toastService } from '$lib/service/toast.service.svelte';
	import { formatBytes } from '$lib/tool/format-bytes';
	import {
	import AppMarkIcon from '$lib/components/app-mark-icon.svelte';
		LucideFolder,
		LucideLink,
		LucidePin,
		LucideRotateCcw,
		LucideStar,
		LucideTrash2
	} from '@lucide/svelte';
	import { onMount } from 'svelte';

	type ApiRow = {
		id: string;
		name: string;
		itemType: string;
		sizeBytes: number;
		updatedAt: string;
		trashedAt: string;
		purgeAt: string;
		storageProvider: StorageProviderId;
		isPinned: boolean;
		isStarred: boolean;
		color: string | null;
		parentId: string | null;
		ownerName: string;
	};

	type TrashItem = {
		id: string;
		name: string;
		itemType: 'file' | 'folder';
		sizeBytes: number | null;
		updatedAt: string;
		trashedAt: string;
		purgeAt: string;
		storageProvider: StorageProviderId;
		pinned: boolean;
		starred: boolean;
		color: FileLabelColorId | string | null;
		parentId: string | null;
		ownerName: string;
	};

	let rows = $state<TrashItem[]>([]);
	let trashRetentionDays = $state(30);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let busyId = $state<string | null>(null);

	function mapRow(f: ApiRow): TrashItem {
		return {
			id: f.id,
			name: f.name,
			itemType: f.itemType === 'folder' ? 'folder' : 'file',
			sizeBytes: f.sizeBytes,
			updatedAt: f.updatedAt.slice(0, 10),
			trashedAt: f.trashedAt.slice(0, 10),
			purgeAt: f.purgeAt,
			storageProvider: f.storageProvider,
			pinned: f.isPinned,
			starred: f.isStarred,
			color: f.color as FileLabelColorId | null,
			parentId: f.parentId ?? null,
			ownerName: f.ownerName
		};
	}

	function daysUntilPurge(purgeIso: string): number {
		const end = new Date(purgeIso).getTime();
		const now = Date.now();
		return Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));
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
			if (!r.ok) {
				const t = await r.text();
				throw new Error(t || r.statusText);
			}
			const payload = (await r.json()) as { files: ApiRow[]; trashRetentionDays?: number };
			if (typeof payload.trashRetentionDays === 'number') {
				trashRetentionDays = payload.trashRetentionDays;
			}
			rows = payload.files.map(mapRow);
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load trash';
			rows = [];
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void loadTrash();
		return registerDriveListReload(() => void loadTrash());
	});

	async function runPatch(id: string, body: PatchDriveFileBody, successMsg?: string) {
		busyId = id;
		try {
			await patchDriveFile(id, body);
			bumpDriveListRefresh();
			if (successMsg) toastService.addToast(successMsg, StatusColorEnum.SUCCESS);
			await loadTrash();
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Update failed',
				StatusColorEnum.ERROR
			);
		} finally {
			busyId = null;
		}
	}

	async function onRestore(item: TrashItem) {
		busyId = item.id;
		try {
			await patchDriveFile(item.id, { trashed: false });
			bumpDriveListRefresh();
			toastService.addToast('Restored to your drive', StatusColorEnum.SUCCESS);
			await loadTrash();
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Restore failed',
				StatusColorEnum.ERROR
			);
		} finally {
			busyId = null;
		}
	}

	async function onDeleteForever(item: TrashItem) {
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
			await loadTrash();
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Permanent delete failed',
				StatusColorEnum.ERROR
			);
		} finally {
			busyId = null;
		}
	}

	const partitionedTrash = $derived.by(() => {
		const sorted = rows.slice().sort((a, b) => a.name.localeCompare(b.name));
		const pinned: TrashItem[] = [];
		const starred: TrashItem[] = [];
		const other: TrashItem[] = [];
		for (const r of sorted) {
			if (r.pinned) pinned.push(r);
			else if (r.starred) starred.push(r);
			else other.push(r);
		}
		return { pinned, starred, other };
	});
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
				<table class="d-table w-full min-w-[64rem] d-table-zebra">
					<thead>
						<tr class="border-b border-base-300">
							<th class="min-w-[12rem]">Name</th>
							<th class="w-28">Size</th>
							<th class="w-36">Modified</th>
							<th class="w-36">Trashed</th>
							<th class="min-w-[9rem]">Auto-remove</th>
							<th class="w-32">Storage</th>
							<th class="min-w-[7rem]">Owner</th>
							<th class="w-24 text-center">Pin</th>
							<th class="w-24 text-center">Star</th>
							<th class="w-44 text-center">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#snippet trashRow(item: TrashItem)}
							<tr
								class="border-l-4 transition-colors hover:bg-info/50 {fileLabelBorderClass(
									item.color
								)}"
							>
								<td>
									<span class="inline-flex max-w-full min-w-0 items-center gap-2">
										{#if item.itemType === 'folder'}
											<LucideFolder
												class="size-5 shrink-0 {fileLabelIconClass(item.color)}"
												aria-hidden="true"
											/>
										{:else}
											<AppMarkIcon
												class="size-5 shrink-0 {fileLabelIconClass(item.color ?? 'base')}"
											/>
										{/if}
										<span class="truncate font-medium">{item.name}</span>
									</span>
								</td>
								<td class="text-base-content/80 tabular-nums">{formatBytes(item.sizeBytes)}</td>
								<td class="text-base-content/80">{item.updatedAt}</td>
								<td class="text-base-content/80">{item.trashedAt}</td>
								<td class="text-sm text-base-content/80">{purgeLabel(item.purgeAt)}</td>
								<td class="text-sm">{storageProviderLabel(item.storageProvider)}</td>
								<td
									class="max-w-[8rem] truncate text-sm text-base-content/80"
									title={item.ownerName}
								>
									{item.ownerName}
								</td>
								<td class="text-center">
									<button
										type="button"
										class="d-btn d-btn-square d-btn-ghost d-btn-sm"
										aria-pressed={item.pinned}
										aria-label={item.pinned ? 'Unpin' : 'Pin'}
										disabled={busyId === item.id}
										onclick={() =>
											void runPatch(item.id, { isPinned: !item.pinned }, item.pinned ? 'Unpinned' : 'Pinned')}
									>
										<LucidePin class="size-4 {item.pinned ? 'text-primary' : 'text-base-content/30'}" />
									</button>
								</td>
								<td class="text-center">
									<button
										type="button"
										class="d-btn d-btn-square d-btn-ghost d-btn-sm"
										aria-pressed={item.starred}
										aria-label={item.starred ? 'Unstar' : 'Star'}
										disabled={busyId === item.id}
										onclick={() =>
											void runPatch(
												item.id,
												{ isStarred: !item.starred },
												item.starred ? 'Unstarred' : 'Starred'
											)}
									>
										<LucideStar
											class="size-4 {item.starred
												? 'fill-warning text-warning'
												: 'text-base-content/30'}"
										/>
									</button>
								</td>
								<td class="text-center">
									<div class="flex flex-wrap items-center justify-center gap-1">
										<div
											class="d-tooltip d-tooltip-top"
											data-tip="Restore the item to manage links from Home"
										>
											<button type="button" class="d-btn gap-1 d-btn-ghost d-btn-sm" disabled>
												<LucideLink class="size-3.5" aria-hidden="true" />
												Link
											</button>
										</div>
										<button
											type="button"
											class="d-btn gap-1 d-btn-ghost d-btn-sm"
											disabled={busyId === item.id}
											onclick={() => void onRestore(item)}
										>
											<LucideRotateCcw class="size-3.5" aria-hidden="true" />
											Restore
										</button>
										<button
											type="button"
											class="d-btn gap-1 text-error d-btn-ghost d-btn-sm"
											disabled={busyId === item.id}
											onclick={() => void onDeleteForever(item)}
										>
											<LucideTrash2 class="size-3.5" aria-hidden="true" />
											Delete
										</button>
									</div>
								</td>
							</tr>
						{/snippet}
						<tr class="bg-base-200/60 hover:bg-base-200/60">
							<td colspan="10" class="py-2 text-xs font-semibold tracking-wide uppercase">
								<span class="text-base-content/80">Trash</span>
							</td>
						</tr>
						{#if rows.length === 0 && !loading}
							<tr>
								<td colspan="10" class="py-8 text-center text-base-content/60">
									Trash is empty for {storageProviderLabel(driveStorage.current)}.
									<a href={resolve('/home')} class="link link-primary">Back to Home</a>
								</td>
							</tr>
						{:else}
							{#if partitionedTrash.pinned.length > 0}
								<tr class="bg-base-200/60 hover:bg-base-200/60">
									<td
										colspan="10"
										class="py-2 text-xs font-semibold tracking-wide text-base-content/80 uppercase"
									>
										<span class="inline-flex items-center gap-2">
											<LucidePin class="size-3.5" aria-hidden="true" />
											Pinned
										</span>
									</td>
								</tr>
								{#each partitionedTrash.pinned as item (item.id)}
									{@render trashRow(item)}
								{/each}
							{/if}
							{#if partitionedTrash.starred.length > 0}
								<tr class="bg-base-200/60 hover:bg-base-200/60">
									<td
										colspan="10"
										class="py-2 text-xs font-semibold tracking-wide text-base-content/80 uppercase"
									>
										<span class="inline-flex items-center gap-2">
											<LucideStar class="size-3.5" aria-hidden="true" />
											Starred
										</span>
									</td>
								</tr>
								{#each partitionedTrash.starred as item (item.id)}
									{@render trashRow(item)}
								{/each}
							{/if}
							{#if partitionedTrash.other.length > 0}
								{#if partitionedTrash.pinned.length > 0 || partitionedTrash.starred.length > 0}
									<tr class="bg-base-200/60 hover:bg-base-200/60">
										<td
											colspan="10"
											class="py-2 text-xs font-semibold tracking-wide text-base-content/80 uppercase"
										>
											More
										</td>
									</tr>
								{/if}
								{#each partitionedTrash.other as item (item.id)}
									{@render trashRow(item)}
								{/each}
							{/if}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>
