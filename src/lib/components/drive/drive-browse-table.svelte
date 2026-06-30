<script lang="ts">
	import { LucideArrowLeft, LucideEllipsisVertical } from '@lucide/svelte';
	import { fileLabelBorderClass } from '$lib/model/file-label-color';
	import { storageProviderLabel } from '$lib/model/storage-provider';
	import { formatBytes } from '$lib/tool/format-bytes';
	import {
		DRIVE_TABLE_MIN_WIDTH,
		partitionBrowseRows,
		type DriveItem
	} from '$lib/components/drive/drive-item';
	import DriveSectionHeader from '$lib/components/drive/drive-section-header.svelte';
	import DriveNameCell from '$lib/components/drive/drive-name-cell.svelte';
	import DrivePinStarCells from '$lib/components/drive/drive-pin-star-cells.svelte';
	import type { createDriveFileActions } from '$lib/components/drive/use-drive-file-actions.svelte';

	type Actions = ReturnType<typeof createDriveFileActions>;

	let {
		rows,
		loading = false,
		actions,
		buttonIdPrefix,
		currentFolder = null,
		backFolderHref,
		breadcrumbLabel = 'All files',
		emptyMessage,
		onEnterFolder,
		onScroll
	}: {
		rows: DriveItem[];
		loading?: boolean;
		actions: Actions;
		buttonIdPrefix: string;
		currentFolder?: { name: string } | null;
		backFolderHref: string;
		breadcrumbLabel?: string;
		emptyMessage: string;
		onEnterFolder: (item: DriveItem) => void;
		onScroll?: () => void;
	} = $props();

	const partitioned = $derived(partitionBrowseRows(rows));
</script>

<div class="min-h-0 flex-1 overflow-auto" onscroll={onScroll}>
	<table class="d-table w-full {DRIVE_TABLE_MIN_WIDTH} d-table-zebra">
		<thead>
			<tr class="border-b border-base-300">
				<th class="min-w-[14rem]">Name</th>
				<th class="w-28">Size</th>
				<th class="w-36">Modified</th>
				<th class="w-32">Storage</th>
				<th class="min-w-[8rem]">Owner</th>
				<th class="w-24 text-center">Pin</th>
				<th class="w-24 text-center">Star</th>
				<th class="w-14 text-center"></th>
			</tr>
		</thead>
		<tbody>
			{#if partitioned.pinned.length > 0}
				<DriveSectionHeader colspan={8} label="Pinned" icon="pin" />
				{#each partitioned.pinned as item (item.id)}
					<tr
						class="border-l-4 transition-colors hover:bg-info/50 {fileLabelBorderClass(item.color)}"
					>
						{@render browseRow(item)}
					</tr>
				{/each}
			{/if}

			{#if partitioned.starred.length > 0}
				<DriveSectionHeader colspan={8} label="Starred" icon="star" />
				{#each partitioned.starred as item (item.id)}
					<tr
						class="border-l-4 transition-colors hover:bg-info/50 {fileLabelBorderClass(item.color)}"
					>
						{@render browseRow(item)}
					</tr>
				{/each}
			{/if}

			<tr class="bg-base-200/60 hover:bg-base-200/60">
				<td colspan="8" class="py-2 text-xs font-semibold tracking-wide uppercase">
					{#if currentFolder}
						<a
							href={backFolderHref}
							class="inline-flex max-w-full min-w-0 items-center gap-2 text-base-content/80 normal-case no-underline hover:text-base-content hover:underline"
							aria-label="Back out of {currentFolder.name}"
						>
							<LucideArrowLeft class="size-3.5 shrink-0" aria-hidden="true" />
							<span class="truncate font-medium">{currentFolder.name}</span>
						</a>
					{:else}
						<span class="text-base-content/80">{breadcrumbLabel}</span>
					{/if}
				</td>
			</tr>

			{#if rows.length === 0 && !loading}
				<tr>
					<td colspan="8" class="py-8 text-center text-base-content/60">
						{emptyMessage}
					</td>
				</tr>
			{:else}
				{#each partitioned.other as item (item.id)}
					<tr
						class="border-l-4 transition-colors hover:bg-info/50 {fileLabelBorderClass(item.color)}"
					>
						{@render browseRow(item)}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>

{#snippet browseRow(item: DriveItem)}
	<td>
		<DriveNameCell {item} {onEnterFolder} />
	</td>
	<td class="text-base-content/80 tabular-nums">{formatBytes(item.sizeBytes)}</td>
	<td class="text-base-content/80">{item.updatedAt}</td>
	<td class="text-sm">{storageProviderLabel(item.storageProvider)}</td>
	<td class="max-w-[10rem] truncate text-sm text-base-content/80" title={item.ownerName}>
		{item.ownerName}
	</td>
	<DrivePinStarCells
		{item}
		busyId={actions.busyId}
		editable={actions.canEdit(item)}
		onTogglePin={(i) => void actions.runPatch(i.id, { isPinned: !i.pinned })}
		onToggleStar={(i) => void actions.runPatch(i.id, { isStarred: !i.starred })}
	/>
	<td class="text-center">
		{#if actions.canEdit(item)}
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
