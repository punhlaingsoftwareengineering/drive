<script lang="ts">
	import { LucideLink, LucideRotateCcw, LucideTrash2 } from '@lucide/svelte';
	import { fileLabelBorderClass } from '$lib/model/file-label-color';
	import { storageProviderLabel } from '$lib/model/storage-provider';
	import { formatBytes } from '$lib/tool/format-bytes';
	import {
		DRIVE_TABLE_MIN_WIDTH,
		partitionDriveRows,
		type TrashDriveItem
	} from '$lib/components/drive/drive-item';
	import DriveSectionHeader from '$lib/components/drive/drive-section-header.svelte';
	import DriveNameCell from '$lib/components/drive/drive-name-cell.svelte';
	import DrivePinStarCells from '$lib/components/drive/drive-pin-star-cells.svelte';

	let {
		rows,
		loading = false,
		busyId = null,
		emptyMessage,
		purgeLabel,
		onTogglePin,
		onToggleStar,
		onRestore,
		onDeleteForever
	}: {
		rows: TrashDriveItem[];
		loading?: boolean;
		busyId?: string | null;
		emptyMessage: string;
		purgeLabel: (purgeIso: string) => string;
		onTogglePin: (item: TrashDriveItem) => void;
		onToggleStar: (item: TrashDriveItem) => void;
		onRestore: (item: TrashDriveItem) => void;
		onDeleteForever: (item: TrashDriveItem) => void;
	} = $props();

	const partitioned = $derived(partitionDriveRows(rows));
</script>

<div class="min-h-0 flex-1 overflow-auto">
	<table class="d-table w-full {DRIVE_TABLE_MIN_WIDTH} d-table-zebra">
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
			<DriveSectionHeader colspan={10} label="Trash" />
			{#if rows.length === 0 && !loading}
				<tr>
					<td colspan="10" class="py-8 text-center text-base-content/60">{emptyMessage}</td>
				</tr>
			{:else}
				{#if partitioned.pinned.length > 0}
					<DriveSectionHeader colspan={10} label="Pinned" icon="pin" />
					{#each partitioned.pinned as item (item.id)}
						<tr
							class="border-l-4 transition-colors hover:bg-info/50 {fileLabelBorderClass(
								item.color
							)}"
						>
							{@render trashRow(item)}
						</tr>
					{/each}
				{/if}
				{#if partitioned.starred.length > 0}
					<DriveSectionHeader colspan={10} label="Starred" icon="star" />
					{#each partitioned.starred as item (item.id)}
						<tr
							class="border-l-4 transition-colors hover:bg-info/50 {fileLabelBorderClass(
								item.color
							)}"
						>
							{@render trashRow(item)}
						</tr>
					{/each}
				{/if}
				{#if partitioned.other.length > 0}
					{#if partitioned.pinned.length > 0 || partitioned.starred.length > 0}
						<DriveSectionHeader colspan={10} label="More" />
					{/if}
					{#each partitioned.other as item (item.id)}
						<tr
							class="border-l-4 transition-colors hover:bg-info/50 {fileLabelBorderClass(
								item.color
							)}"
						>
							{@render trashRow(item)}
						</tr>
					{/each}
				{/if}
			{/if}
		</tbody>
	</table>
</div>

{#snippet trashRow(item: TrashDriveItem)}
	<td>
		<DriveNameCell {item} />
	</td>
	<td class="text-base-content/80 tabular-nums">{formatBytes(item.sizeBytes)}</td>
	<td class="text-base-content/80">{item.updatedAt}</td>
	<td class="text-base-content/80">{item.trashedAt}</td>
	<td class="text-sm text-base-content/80">{purgeLabel(item.purgeAt)}</td>
	<td class="text-sm">{storageProviderLabel(item.storageProvider)}</td>
	<td class="max-w-[8rem] truncate text-sm text-base-content/80" title={item.ownerName}>
		{item.ownerName}
	</td>
	<DrivePinStarCells
		{item}
		{busyId}
		onTogglePin={() => onTogglePin(item)}
		onToggleStar={() => onToggleStar(item)}
	/>
	<td class="text-center">
		<div class="flex flex-wrap items-center justify-center gap-1">
			<div class="d-tooltip d-tooltip-top" data-tip="Restore the item to manage links from Home">
				<button type="button" class="d-btn gap-1 d-btn-ghost d-btn-sm" disabled>
					<LucideLink class="size-3.5" aria-hidden="true" />
					Link
				</button>
			</div>
			<button
				type="button"
				class="d-btn gap-1 d-btn-ghost d-btn-sm"
				disabled={busyId === item.id}
				onclick={() => onRestore(item)}
			>
				<LucideRotateCcw class="size-3.5" aria-hidden="true" />
				Restore
			</button>
			<button
				type="button"
				class="d-btn gap-1 text-error d-btn-ghost d-btn-sm"
				disabled={busyId === item.id}
				onclick={() => onDeleteForever(item)}
			>
				<LucideTrash2 class="size-3.5" aria-hidden="true" />
				Delete
			</button>
		</div>
	</td>
{/snippet}
