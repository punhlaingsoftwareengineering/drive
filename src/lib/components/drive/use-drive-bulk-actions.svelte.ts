import { batchPatchDriveFiles, moveDriveItems } from '$lib/client/drive-batch';
import { downloadDriveFileAsBlob, permanentDeleteDriveFile } from '$lib/client/drive-file';
import type { DriveItem } from '$lib/components/drive/drive-item';
import type { DriveSelection } from '$lib/components/drive/use-drive-selection.svelte';
import type { FileLabelColorId } from '$lib/model/file-label-color';
import type { StorageProviderId } from '$lib/model/storage-provider';
import { bumpDriveListRefresh } from '$lib/state/drive-refresh.svelte';
import { toastService } from '$lib/service/toast.service.svelte';
import { StatusColorEnum } from '$lib/model/enum/color.enum';

type BulkActionsOptions = {
	selection: DriveSelection;
	getRows: () => DriveItem[];
	canEditItem?: (item: DriveItem) => boolean;
	storageProvider: () => StorageProviderId;
	teamId?: () => string | undefined;
};

export function createDriveBulkActions(options: BulkActionsOptions) {
	let busy = $state(false);
	let moveDialogEl = $state<HTMLDialogElement | null>(null);
	let colorDialogEl = $state<HTMLDialogElement | null>(null);
	let colorTargetIds = $state<string[]>([]);

	function canEdit(item: DriveItem): boolean {
		return options.canEditItem?.(item) ?? true;
	}

	function selectedEditable(): DriveItem[] {
		const items = options.selection.selectedItems(options.getRows());
		return items.filter(canEdit);
	}

	function allSelectedEditable(): boolean {
		const items = options.selection.selectedItems(options.getRows());
		return options.selection.allSelectedEditable(items, canEdit);
	}

	function reportBatchResult(label: string, failed: { id: string; reason: string }[]) {
		if (failed.length === 0) {
			toastService.addToast(label, StatusColorEnum.SUCCESS);
		} else {
			toastService.addToast(
				`${label}: ${failed.length} failed`,
				failed.length === options.selection.count ? StatusColorEnum.ERROR : StatusColorEnum.WARNING
			);
		}
	}

	async function runBatch(patch: Parameters<typeof batchPatchDriveFiles>[1], successLabel: string) {
		const items = selectedEditable();
		if (items.length === 0) return;
		busy = true;
		try {
			const result = await batchPatchDriveFiles(
				items.map((i) => i.id),
				patch
			);
			bumpDriveListRefresh();
			options.selection.clear();
			reportBatchResult(successLabel, result.failed);
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Bulk update failed',
				StatusColorEnum.ERROR
			);
		} finally {
			busy = false;
		}
	}

	async function bulkDownload() {
		const items = options.selection.selectedItems(options.getRows());
		if (items.length === 0) return;
		busy = true;
		try {
			for (const item of items) {
				const fallback = item.itemType === 'folder' ? `${item.name}.zip` : item.name;
				await downloadDriveFileAsBlob(item.id, fallback);
			}
			if (items.length > 1) {
				toastService.addToast(`Downloaded ${items.length} items`, StatusColorEnum.SUCCESS);
			}
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Download failed',
				StatusColorEnum.ERROR
			);
		} finally {
			busy = false;
		}
	}

	async function bulkTrash() {
		const items = selectedEditable();
		if (items.length === 0) return;
		const msg =
			items.length === 1
				? `Move “${items[0]!.name}” to trash?`
				: `Move ${items.length} items to trash?`;
		if (!confirm(msg)) return;
		await runBatch({ trashed: true }, 'Moved to trash');
	}

	async function bulkRestore() {
		await runBatch({ trashed: false }, 'Restored');
	}

	async function bulkPin() {
		await runBatch({ isPinned: true }, 'Pinned');
	}

	async function bulkStar() {
		await runBatch({ isStarred: true }, 'Starred');
	}

	function openBulkColor() {
		const items = selectedEditable();
		if (items.length === 0) return;
		colorTargetIds = items.map((i) => i.id);
		queueMicrotask(() => colorDialogEl?.showModal());
	}

	async function pickBulkColor(c: FileLabelColorId) {
		if (colorTargetIds.length === 0) return;
		busy = true;
		try {
			const result = await batchPatchDriveFiles(colorTargetIds, { color: c });
			bumpDriveListRefresh();
			options.selection.clear();
			colorDialogEl?.close();
			colorTargetIds = [];
			reportBatchResult('Color updated', result.failed);
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Color update failed',
				StatusColorEnum.ERROR
			);
		} finally {
			busy = false;
		}
	}

	async function clearBulkColor() {
		if (colorTargetIds.length === 0) return;
		busy = true;
		try {
			const result = await batchPatchDriveFiles(colorTargetIds, { color: null });
			bumpDriveListRefresh();
			options.selection.clear();
			colorDialogEl?.close();
			colorTargetIds = [];
			reportBatchResult('Color cleared', result.failed);
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Color update failed',
				StatusColorEnum.ERROR
			);
		} finally {
			busy = false;
		}
	}

	async function bulkDeleteForever() {
		const items = selectedEditable();
		if (items.length === 0) return;
		const msg =
			items.length === 1
				? `Permanently delete “${items[0]!.name}”?`
				: `Permanently delete ${items.length} items? This cannot be undone.`;
		if (!confirm(msg)) return;
		busy = true;
		const failed: { id: string; reason: string }[] = [];
		try {
			for (const item of items) {
				try {
					await permanentDeleteDriveFile(item.id);
				} catch (e) {
					failed.push({ id: item.id, reason: e instanceof Error ? e.message : 'Delete failed' });
				}
			}
			bumpDriveListRefresh();
			options.selection.clear();
			reportBatchResult('Permanently deleted', failed);
		} finally {
			busy = false;
		}
	}

	function openMoveDialog() {
		if (!allSelectedEditable()) return;
		queueMicrotask(() => moveDialogEl?.showModal());
	}

	async function moveToParent(parentId: string | null) {
		const items = selectedEditable();
		if (items.length === 0) return;
		busy = true;
		try {
			const result = await moveDriveItems({
				ids: items.map((i) => i.id),
				parentId,
				teamId: options.teamId?.(),
				storageProvider: options.storageProvider()
			});
			bumpDriveListRefresh();
			options.selection.clear();
			moveDialogEl?.close();
			reportBatchResult('Moved', result.failed);
		} catch (e) {
			toastService.addToast(e instanceof Error ? e.message : 'Move failed', StatusColorEnum.ERROR);
		} finally {
			busy = false;
		}
	}

	async function moveIdsToParent(ids: string[], parentId: string | null) {
		if (ids.length === 0) return;
		busy = true;
		try {
			const result = await moveDriveItems({
				ids,
				parentId,
				teamId: options.teamId?.(),
				storageProvider: options.storageProvider()
			});
			bumpDriveListRefresh();
			options.selection.clear();
			reportBatchResult('Moved', result.failed);
		} catch (e) {
			toastService.addToast(e instanceof Error ? e.message : 'Move failed', StatusColorEnum.ERROR);
		} finally {
			busy = false;
		}
	}

	return {
		get busy() {
			return busy;
		},
		get moveDialogEl() {
			return moveDialogEl;
		},
		set moveDialogEl(v) {
			moveDialogEl = v;
		},
		get colorDialogEl() {
			return colorDialogEl;
		},
		set colorDialogEl(v) {
			colorDialogEl = v;
		},
		allSelectedEditable,
		bulkDownload,
		bulkTrash,
		bulkRestore,
		bulkPin,
		bulkStar,
		openBulkColor,
		pickBulkColor,
		clearBulkColor,
		bulkDeleteForever,
		openMoveDialog,
		moveToParent,
		moveIdsToParent
	};
}
