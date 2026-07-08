/** Range-select helpers (exported for unit tests). */
export function selectRangeIds(
	anchorId: string,
	targetId: string,
	orderedIds: string[],
	current: Set<string>
): Set<string> {
	const from = orderedIds.indexOf(anchorId);
	const to = orderedIds.indexOf(targetId);
	if (from < 0 || to < 0) return current;
	const start = Math.min(from, to);
	const end = Math.max(from, to);
	const next = new Set(current);
	for (let i = start; i <= end; i++) {
		next.add(orderedIds[i]!);
	}
	return next;
}

export function allItemsPass<T>(items: T[], predicate: (item: T) => boolean): boolean {
	return items.length > 0 && items.every(predicate);
}

export function createDriveSelection() {
	let selectedIds = $state<Set<string>>(new Set());
	let anchorId = $state<string | null>(null);
	let lastClickedId = $state<string | null>(null);

	function isSelected(id: string): boolean {
		return selectedIds.has(id);
	}

	function toggle(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
		anchorId = id;
		lastClickedId = id;
	}

	function selectOnly(id: string) {
		selectedIds = new Set([id]);
		anchorId = id;
		lastClickedId = id;
	}

	function selectAll(visibleIds: string[]) {
		selectedIds = new Set(visibleIds);
	}

	function clear() {
		selectedIds = new Set();
		anchorId = null;
		lastClickedId = null;
	}

	function selectRange(targetId: string, orderedIds: string[]) {
		const anchor = anchorId ?? lastClickedId;
		if (!anchor) {
			selectOnly(targetId);
			return;
		}
		selectedIds = selectRangeIds(anchor, targetId, orderedIds, selectedIds);
		lastClickedId = targetId;
	}

	function handleRowClick(
		id: string,
		orderedIds: string[],
		e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }
	) {
		if (e.shiftKey) {
			selectRange(id, orderedIds);
			return;
		}
		if (e.metaKey || e.ctrlKey) {
			toggle(id);
			return;
		}
		if (selectedIds.has(id) && selectedIds.size === 1) {
			clear();
			return;
		}
		selectOnly(id);
	}

	function headerCheckedState(visibleIds: string[]): 'none' | 'some' | 'all' {
		if (visibleIds.length === 0) return 'none';
		let count = 0;
		for (const id of visibleIds) {
			if (selectedIds.has(id)) count++;
		}
		if (count === 0) return 'none';
		if (count === visibleIds.length) return 'all';
		return 'some';
	}

	function toggleSelectAll(visibleIds: string[]) {
		if (headerCheckedState(visibleIds) === 'all') clear();
		else selectAll(visibleIds);
	}

	function selectedItems<T extends { id: string }>(rows: T[]): T[] {
		return rows.filter((r) => selectedIds.has(r.id));
	}

	function allSelectedEditable<T>(items: T[], canEdit: (item: T) => boolean): boolean {
		return allItemsPass(items, canEdit);
	}

	function attachEscapeListener() {
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape' && selectedIds.size > 0) {
				clear();
			}
		}
		document.addEventListener('keydown', onKey, true);
		return () => document.removeEventListener('keydown', onKey, true);
	}

	return {
		get selectedIds() {
			return selectedIds;
		},
		get count() {
			return selectedIds.size;
		},
		get anchorId() {
			return anchorId;
		},
		isSelected,
		toggle,
		selectOnly,
		selectAll,
		clear,
		selectRange,
		handleRowClick,
		headerCheckedState,
		toggleSelectAll,
		selectedItems,
		allSelectedEditable,
		attachEscapeListener
	};
}

export type DriveSelection = ReturnType<typeof createDriveSelection>;
