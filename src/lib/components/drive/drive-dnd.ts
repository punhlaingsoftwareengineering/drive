/** Custom dataTransfer types for in-app drive drag-and-drop. */
export const DRIVE_REORDER_MIME = 'application/x-drive-reorder';
export const DRIVE_MOVE_MIME = 'application/x-drive-items';

export function parseMoveDragIds(dataTransfer: DataTransfer | null): string[] {
	if (!dataTransfer?.types.includes(DRIVE_MOVE_MIME)) return [];
	try {
		const raw = dataTransfer.getData(DRIVE_MOVE_MIME);
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
	} catch {
		return [];
	}
}

export function parseReorderDragId(dataTransfer: DataTransfer | null): string | null {
	if (!dataTransfer?.types.includes(DRIVE_REORDER_MIME)) return null;
	const id = dataTransfer.getData(DRIVE_REORDER_MIME);
	return id || null;
}

export function isOsFileDrag(dataTransfer: DataTransfer | null): boolean {
	return Boolean(dataTransfer?.types.includes('Files'));
}
