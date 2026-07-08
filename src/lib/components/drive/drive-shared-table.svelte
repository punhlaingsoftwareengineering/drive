<script lang="ts">
	import { LucideDownload, LucideLink } from '@lucide/svelte';
	import { fileLabelBorderClass } from '$lib/model/file-label-color';
	import { storageProviderLabel } from '$lib/model/storage-provider';
	import { formatBytes } from '$lib/tool/format-bytes';
	import {
		DRIVE_TABLE_MIN_WIDTH,
		partitionDriveRows,
		type DriveItem
	} from '$lib/components/drive/drive-item';
	import DriveSectionHeader from '$lib/components/drive/drive-section-header.svelte';
	import DriveNameCell from '$lib/components/drive/drive-name-cell.svelte';
	import DrivePinStarCells from '$lib/components/drive/drive-pin-star-cells.svelte';
	import DriveSelectionCheckbox from '$lib/components/drive/drive-selection-checkbox.svelte';
	import type { DriveSelection } from '$lib/components/drive/use-drive-selection.svelte';

	let {
		rows,
		loading = false,
		busyId = null,
		selection,
		currentFolder = null,
		backFolderHref,
		breadcrumbLabel = 'Shared with you',
		emptyMessage,
		onEnterFolder,
		onDownload
	}: {
		rows: DriveItem[];
		loading?: boolean;
		busyId?: string | null;
		selection: DriveSelection;
		currentFolder?: { name: string } | null;
		backFolderHref: string;
		breadcrumbLabel?: string;
		emptyMessage: string;
		onEnterFolder: (item: DriveItem) => void;
		onDownload: (item: DriveItem) => void;
	} = $props();

	const partitioned = $derived(partitionDriveRows(rows));
	const visibleIds = $derived(rows.map((r) => r.id));
	const headerState = $derived(selection.headerCheckedState(visibleIds));

	function rowClass(item: DriveItem): string {
		return `border-l-4 transition-colors hover:bg-info/50 ${fileLabelBorderClass(item.color)} ${selection.isSelected(item.id) ? 'bg-primary/10' : ''}`;
	}
</script>

<div class="min-h-0 flex-1 overflow-auto">
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
			{#if partitioned.pinned.length > 0}
				<DriveSectionHeader colspan={9} label="Pinned" icon="pin" />
				{#each partitioned.pinned as item (item.id)}
					<tr class={rowClass(item)}>
						{@render sharedRow(item)}
					</tr>
				{/each}
			{/if}

			{#if partitioned.starred.length > 0}
				<DriveSectionHeader colspan={9} label="Starred" icon="star" />
				{#each partitioned.starred as item (item.id)}
					<tr class={rowClass(item)}>
						{@render sharedRow(item)}
					</tr>
				{/each}
			{/if}

			<tr class="bg-base-200/60 hover:bg-base-200/60">
				<td colspan="9" class="py-2 text-xs font-semibold tracking-wide uppercase">
					{#if currentFolder}
						<a
							href={backFolderHref}
							class="inline-flex max-w-full min-w-0 items-center gap-2 text-base-content/80 normal-case no-underline hover:text-base-content hover:underline"
						>
							<span class="truncate font-medium">{currentFolder.name}</span>
						</a>
					{:else}
						<span class="text-base-content/80">{breadcrumbLabel}</span>
					{/if}
				</td>
			</tr>

			{#if rows.length === 0 && !loading}
				<tr>
					<td colspan="9" class="py-8 text-center text-base-content/60">{emptyMessage}</td>
				</tr>
			{:else if partitioned.other.length > 0}
				{#if partitioned.pinned.length > 0 || partitioned.starred.length > 0}
					<DriveSectionHeader colspan={9} label="More" />
				{/if}
				{#each partitioned.other as item (item.id)}
					<tr class={rowClass(item)}>
						{@render sharedRow(item)}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>

{#snippet sharedRow(item: DriveItem)}
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
		<DriveNameCell {item} {onEnterFolder} />
	</td>
	<td class="text-base-content/80 tabular-nums">{formatBytes(item.sizeBytes)}</td>
	<td class="text-base-content/80">{item.updatedAt}</td>
	<td class="text-sm">{storageProviderLabel(item.storageProvider)}</td>
	<td class="max-w-[10rem] truncate text-sm text-base-content/80" title={item.ownerName}>
		{item.ownerName}
	</td>
	<DrivePinStarCells {item} editable={false} />
	<td class="text-center">
		<div class="flex items-center justify-center gap-1">
			<button
				type="button"
				class="d-btn d-btn-square d-btn-ghost d-btn-sm"
				aria-label={item.itemType === 'folder'
					? `Download ${item.name} as ZIP`
					: `Download ${item.name}`}
				disabled={busyId === item.id}
				onclick={() => onDownload(item)}
			>
				<LucideDownload class="size-4" />
			</button>
			<div class="d-tooltip d-tooltip-top" data-tip="Only the owner can create a public link">
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
{/snippet}
