<script lang="ts">
	import { LucideArrowLeft, LucideEllipsisVertical, LucideGripVertical } from '@lucide/svelte';
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
	import DriveSelectionCheckbox from '$lib/components/drive/drive-selection-checkbox.svelte';
	import {
		DRIVE_MOVE_MIME,
		DRIVE_REORDER_MIME,
		parseMoveDragIds,
		parseReorderDragId
	} from '$lib/components/drive/drive-dnd';
	import type { createDriveFileActions } from '$lib/components/drive/use-drive-file-actions.svelte';
	import type { DriveSelection } from '$lib/components/drive/use-drive-selection.svelte';

	type Actions = ReturnType<typeof createDriveFileActions>;

	let {
		rows,
		loading = false,
		actions,
		selection,
		buttonIdPrefix,
		currentFolder = null,
		backFolderHref,
		breadcrumbLabel = 'All files',
		emptyMessage,
		onEnterFolder,
		onScroll,
		onReorder,
		onMove
	}: {
		rows: DriveItem[];
		loading?: boolean;
		actions: Actions;
		selection: DriveSelection;
		buttonIdPrefix: string;
		currentFolder?: { name: string } | null;
		backFolderHref: string;
		breadcrumbLabel?: string;
		emptyMessage: string;
		onEnterFolder: (item: DriveItem) => void;
		onScroll?: () => void;
		onReorder?: (orderedIds: string[]) => void | Promise<void>;
		onMove?: (ids: string[], parentId: string | null) => void | Promise<void>;
	} = $props();

	const partitioned = $derived(partitionBrowseRows(rows));
	const visibleIds = $derived(rows.map((r) => r.id));
	const headerState = $derived(selection.headerCheckedState(visibleIds));

	let reorderDragId = $state<string | null>(null);
	let moveDragIds = $state<string[]>([]);
	let moveDropTargetId = $state<string | null>(null);
	let rootDropActive = $state(false);

	function reorderOtherRows(sourceId: string, targetId: string) {
		if (!onReorder || sourceId === targetId) return;
		const other = partitioned.other.map((r) => r.id);
		const from = other.indexOf(sourceId);
		const to = other.indexOf(targetId);
		if (from < 0 || to < 0) return;
		other.splice(from, 1);
		other.splice(to, 0, sourceId);
		void onReorder(other);
	}

	function idsForMoveDrag(item: DriveItem): string[] {
		if (selection.count > 0 && selection.isSelected(item.id)) {
			return [...selection.selectedIds];
		}
		return [item.id];
	}

	function onGripDragStart(e: DragEvent, itemId: string) {
		if (!onReorder || !actions.canEdit(rows.find((r) => r.id === itemId)!)) return;
		reorderDragId = itemId;
		e.dataTransfer?.setData(DRIVE_REORDER_MIME, itemId);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function onRowMoveDragStart(e: DragEvent, item: DriveItem) {
		if (!onMove || !actions.canEdit(item)) return;
		const ids = idsForMoveDrag(item);
		moveDragIds = ids;
		e.dataTransfer?.setData(DRIVE_MOVE_MIME, JSON.stringify(ids));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function onDragEnd() {
		reorderDragId = null;
		moveDragIds = [];
		moveDropTargetId = null;
		rootDropActive = false;
	}

	function onReorderDragOver(e: DragEvent) {
		if (parseReorderDragId(e.dataTransfer)) e.preventDefault();
	}

	function onReorderDrop(e: DragEvent, targetId: string) {
		e.preventDefault();
		const sourceId = parseReorderDragId(e.dataTransfer) ?? reorderDragId;
		if (sourceId) reorderOtherRows(sourceId, targetId);
		onDragEnd();
	}

	function onFolderDragOver(e: DragEvent, folderId: string | null) {
		const ids = parseMoveDragIds(e.dataTransfer);
		if (ids.length === 0 && moveDragIds.length === 0) return;
		const dragging = ids.length > 0 ? ids : moveDragIds;
		if (folderId && dragging.includes(folderId)) return;
		e.preventDefault();
		if (folderId) moveDropTargetId = folderId;
		else rootDropActive = true;
	}

	function onFolderDragLeave(folderId: string | null) {
		if (folderId === moveDropTargetId) moveDropTargetId = null;
		if (!folderId) rootDropActive = false;
	}

	function onFolderDrop(e: DragEvent, folderId: string | null) {
		e.preventDefault();
		const ids = parseMoveDragIds(e.dataTransfer);
		const toMove = ids.length > 0 ? ids : moveDragIds;
		if (toMove.length > 0 && onMove) {
			void onMove(toMove, folderId);
		}
		onDragEnd();
	}

	function rowClass(item: DriveItem, extra = ''): string {
		const selected = selection.isSelected(item.id);
		return `border-l-4 transition-colors hover:bg-info/50 ${fileLabelBorderClass(item.color)} ${selected ? 'bg-primary/10' : ''} ${extra}`;
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
				<th class="w-14 text-center"></th>
				<th class="min-w-[14rem]">Name</th>
				<th class="w-28">Size</th>
				<th class="w-36">Modified</th>
				<th class="w-32">Storage</th>
				<th class="min-w-[8rem]">Owner</th>
				<th class="w-24 text-center">Pin</th>
				<th class="w-24 text-center">Star</th>
			</tr>
		</thead>
		<tbody>
			{#if partitioned.pinned.length > 0}
				<DriveSectionHeader colspan={9} label="Pinned" icon="pin" />
				{#each partitioned.pinned as item (item.id)}
					<tr
						class={rowClass(item)}
						ondragover={(e) => item.itemType === 'folder' && onFolderDragOver(e, item.id)}
						ondragleave={() => item.itemType === 'folder' && onFolderDragLeave(item.id)}
						ondrop={(e) => item.itemType === 'folder' && onFolderDrop(e, item.id)}
					>
						{@render browseRow(item, false)}
					</tr>
				{/each}
			{/if}

			{#if partitioned.starred.length > 0}
				<DriveSectionHeader colspan={9} label="Starred" icon="star" />
				{#each partitioned.starred as item (item.id)}
					<tr
						class={rowClass(item)}
						ondragover={(e) => item.itemType === 'folder' && onFolderDragOver(e, item.id)}
						ondragleave={() => item.itemType === 'folder' && onFolderDragLeave(item.id)}
						ondrop={(e) => item.itemType === 'folder' && onFolderDrop(e, item.id)}
					>
						{@render browseRow(item, false)}
					</tr>
				{/each}
			{/if}

			<tr
				class="bg-base-200/60 hover:bg-base-200/60 {rootDropActive ? 'ring-2 ring-primary ring-inset' : ''}"
				ondragover={(e) => onMove && onFolderDragOver(e, null)}
				ondragleave={() => onFolderDragLeave(null)}
				ondrop={(e) => onMove && onFolderDrop(e, null)}
			>
				<td colspan="9" class="py-2 text-xs font-semibold tracking-wide uppercase">
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
					<td colspan="9" class="py-8 text-center text-base-content/60">
						{emptyMessage}
					</td>
				</tr>
			{:else}
				{#each partitioned.other as item (item.id)}
					<tr
						class="{rowClass(
							item,
							reorderDragId === item.id || moveDragIds.includes(item.id) ? 'opacity-60' : ''
						)} {item.itemType === 'folder' && moveDropTargetId === item.id
							? 'ring-2 ring-primary ring-inset'
							: ''}"
						ondragover={(e) => {
							if (item.itemType === 'folder') onFolderDragOver(e, item.id);
							else onReorderDragOver(e);
						}}
						ondragleave={() => item.itemType === 'folder' && onFolderDragLeave(item.id)}
						ondrop={(e) => {
							if (parseMoveDragIds(e.dataTransfer).length > 0 || moveDragIds.length > 0) {
								if (item.itemType === 'folder') onFolderDrop(e, item.id);
							} else {
								onReorderDrop(e, item.id);
							}
						}}
					>
						{@render browseRow(item, true)}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>

{#snippet browseRow(item: DriveItem, showDragHandle: boolean)}
	<td class="text-center">
		<DriveSelectionCheckbox
			checked={selection.isSelected(item.id)}
			ariaLabel="Select {item.name}"
			onchange={() => selection.toggle(item.id)}
		/>
	</td>
	<td class="text-center">
		<div class="flex items-center justify-center gap-0.5">
			{#if showDragHandle && onReorder && actions.canEdit(item)}
				<button
					type="button"
					class="cursor-grab text-base-content/40 active:cursor-grabbing"
					aria-label="Drag to reorder"
					draggable={true}
					ondragstart={(e) => onGripDragStart(e, item.id)}
					ondragend={onDragEnd}
				>
					<LucideGripVertical class="size-4" />
				</button>
			{/if}
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
		</div>
	</td>
	<td
		draggable={Boolean(onMove && actions.canEdit(item))}
		ondragstart={(e) => onRowMoveDragStart(e, item)}
		ondragend={onDragEnd}
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
	<DrivePinStarCells
		{item}
		busyId={actions.busyId}
		editable={actions.canEdit(item)}
		onTogglePin={(i) => void actions.runPatch(i.id, { isPinned: !i.pinned })}
		onToggleStar={(i) => void actions.runPatch(i.id, { isStarred: !i.starred })}
	/>
{/snippet}
