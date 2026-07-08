<script lang="ts">
	import { LucideDownload, LucideEllipsisVertical } from '@lucide/svelte';
	import { fileLabelBorderClass } from '$lib/model/file-label-color';
	import { storageProviderLabel } from '$lib/model/storage-provider';
	import { formatBytes } from '$lib/tool/format-bytes';
	import {
		DRIVE_TABLE_MIN_WIDTH,
		partitionDriveRows,
		recentWhereLabel,
		canEditRecentItem,
		type RecentDriveItem
	} from '$lib/components/drive/drive-item';
	import DriveSectionHeader from '$lib/components/drive/drive-section-header.svelte';
	import DriveNameCell from '$lib/components/drive/drive-name-cell.svelte';
	import DrivePinStarCells from '$lib/components/drive/drive-pin-star-cells.svelte';
	import DriveSelectionCheckbox from '$lib/components/drive/drive-selection-checkbox.svelte';
	import type { createDriveFileActions } from '$lib/components/drive/use-drive-file-actions.svelte';
	import type { DriveSelection } from '$lib/components/drive/use-drive-selection.svelte';

	type Actions = ReturnType<typeof createDriveFileActions>;

	let {
		rows,
		loading = false,
		storageLabel,
		actions,
		selection,
		buttonIdPrefix,
		emptyMessage,
		onEnterFolder,
		onDownloadShared,
		onScroll
	}: {
		rows: RecentDriveItem[];
		loading?: boolean;
		storageLabel: string;
		actions: Actions;
		selection: DriveSelection;
		buttonIdPrefix: string;
		emptyMessage: string;
		onEnterFolder: (item: RecentDriveItem) => void;
		onDownloadShared: (item: RecentDriveItem) => void;
		onScroll?: () => void;
	} = $props();

	const partitioned = $derived(partitionDriveRows(rows));
	const visibleIds = $derived(rows.map((r) => r.id));
	const headerState = $derived(selection.headerCheckedState(visibleIds));

	function rowClass(item: RecentDriveItem): string {
		return `border-l-4 transition-colors hover:bg-info/50 ${fileLabelBorderClass(item.color)} ${selection.isSelected(item.id) ? 'bg-primary/10' : ''}`;
	}
</script>

<div class="min-h-0 flex-1 overflow-auto" onscroll={onScroll}>
	<table class="d-table w-full {DRIVE_TABLE_MIN_WIDTH} d-table-zebra">
		<thead>
			<tr class="border-b border-base-300">
				<th class="w-10 text-center">
					<DriveSelectionCheckbox
						checked={headerState === 'all'}
						indeterminate={headerState === 'some'}
						ariaLabel="Select all"
						onchange={() => selection.toggleSelectAll(visibleIds)}
					/>
				</th>
				<th class="min-w-[12rem]">Name</th>
				<th class="min-w-[7rem]">Where</th>
				<th class="w-28">Size</th>
				<th class="w-36">Modified</th>
				<th class="w-36">Recent</th>
				<th class="w-32">Storage</th>
				<th class="min-w-[6rem]">Owner</th>
				<th class="w-24 text-center">Pin</th>
				<th class="w-24 text-center">Star</th>
				<th class="w-14 text-center"></th>
			</tr>
		</thead>
		<tbody>
			<tr class="bg-base-200/60 hover:bg-base-200/60">
				<td colspan="11" class="py-2 text-xs font-semibold tracking-wide text-base-content/80">
					Recent — {storageLabel}
				</td>
			</tr>

			{#if rows.length === 0 && !loading}
				<tr>
					<td colspan="11" class="py-8 text-center text-base-content/60">{emptyMessage}</td>
				</tr>
			{:else}
				{#if partitioned.pinned.length > 0}
					<DriveSectionHeader colspan={11} label="Pinned" icon="pin" />
					{#each partitioned.pinned as item (item.id)}
						<tr class={rowClass(item)}>
							{@render recentRow(item)}
						</tr>
					{/each}
				{/if}
				{#if partitioned.starred.length > 0}
					<DriveSectionHeader colspan={11} label="Starred" icon="star" />
					{#each partitioned.starred as item (item.id)}
						<tr class={rowClass(item)}>
							{@render recentRow(item)}
						</tr>
					{/each}
				{/if}
				{#if partitioned.other.length > 0}
					{#if partitioned.pinned.length > 0 || partitioned.starred.length > 0}
						<DriveSectionHeader colspan={11} label="More" />
					{/if}
					{#each partitioned.other as item (item.id)}
						<tr class={rowClass(item)}>
							{@render recentRow(item)}
						</tr>
					{/each}
				{/if}
			{/if}
		</tbody>
	</table>
</div>

{#snippet recentRow(item: RecentDriveItem)}
	<td class="text-center">
		<DriveSelectionCheckbox
			checked={selection.isSelected(item.id)}
			ariaLabel="Select {item.name}"
			onchange={() => selection.toggle(item.id)}
		/>
	</td>
	<td
		onclick={(e) => {
			const t = e.target;
			if (t instanceof HTMLElement && t.closest('button, a, input, label')) return;
			selection.handleRowClick(item.id, visibleIds, e);
		}}
	>
		<DriveNameCell {item} onEnterFolder={(i) => onEnterFolder(i as RecentDriveItem)} />
	</td>
	<td class="max-w-[9rem] truncate text-sm" title={recentWhereLabel(item)}>
		{recentWhereLabel(item)}
	</td>
	<td class="text-base-content/80 tabular-nums">{formatBytes(item.sizeBytes)}</td>
	<td class="text-base-content/80">{item.updatedAt}</td>
	<td class="text-base-content/80">{item.recencyAt}</td>
	<td class="text-sm">{storageProviderLabel(item.storageProvider)}</td>
	<td class="max-w-[8rem] truncate text-sm text-base-content/80" title={item.ownerName}>
		{item.ownerName}
	</td>
	{#if canEditRecentItem(item)}
		<DrivePinStarCells
			{item}
			busyId={actions.busyId}
			onTogglePin={(i) => void actions.runPatch(i.id, { isPinned: !i.pinned })}
			onToggleStar={(i) => void actions.runPatch(i.id, { isStarred: !i.starred })}
		/>
	{:else}
		<td class="text-center text-base-content/30">—</td>
		<td class="text-center text-base-content/30">—</td>
	{/if}
	<td class="text-center">
		{#if item.source === 'shared'}
			<button
				type="button"
				class="d-btn m-1 d-btn-square d-btn-ghost d-btn-sm"
				aria-label="Download"
				disabled={actions.busyId === item.id}
				onclick={() => onDownloadShared(item)}
			>
				<LucideDownload class="size-4" />
			</button>
		{:else}
			<button
				type="button"
				id="{buttonIdPrefix}{item.id}"
				class="d-btn m-1 d-btn-square d-btn-ghost d-btn-sm"
				aria-label="File actions"
				aria-haspopup="menu"
				aria-expanded={actions.openFileActionsId === item.id}
				disabled={actions.busyId === item.id}
				onclick={(e) =>
					void actions.toggleFileActionsMenu(item.id, e.currentTarget as HTMLButtonElement)}
			>
				<LucideEllipsisVertical class="size-4" />
			</button>
		{/if}
	</td>
{/snippet}
