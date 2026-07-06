import type { FileLabelColorId } from '$lib/model/file-label-color';
import type { StorageProviderId } from '$lib/model/storage-provider';

export const DRIVE_TABLE_MIN_WIDTH = 'min-w-[56rem]';

export type ApiDriveFile = {
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
	sortOrder: number;
};

export type DriveItem = {
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
	sortOrder: number;
};

export type RecentSource = 'own' | 'shared' | 'team';

export type RecentDriveItem = DriveItem & {
	recencyAt: string;
	source: RecentSource;
	teamId: string | null;
	teamName: string | null;
	teamSlug: string | null;
	sharePermission: string | null;
};

export type TrashDriveItem = DriveItem & {
	trashedAt: string;
	purgeAt: string;
};

export type DriveListMode = 'browse' | 'team-browse' | 'recent' | 'shared' | 'trash';

export function mapApiFile(f: ApiDriveFile): DriveItem {
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
		ownerName: f.ownerName,
		sortOrder: f.sortOrder ?? 0
	};
}

function compareDriveRows<T extends { sortOrder: number; name: string }>(a: T, b: T): number {
	const byOrder = a.sortOrder - b.sortOrder;
	if (byOrder !== 0) return byOrder;
	return a.name.localeCompare(b.name);
}

export function partitionDriveRows<
	T extends { pinned: boolean; starred: boolean; name: string; sortOrder: number }
>(rows: T[]): { pinned: T[]; starred: T[]; other: T[] } {
	const sorted = rows.slice().sort(compareDriveRows);
	const pinned: T[] = [];
	const starred: T[] = [];
	const other: T[] = [];
	for (const row of sorted) {
		if (row.pinned) pinned.push(row);
		else if (row.starred) starred.push(row);
		else other.push(row);
	}
	return { pinned, starred, other };
}

export function partitionBrowseRows<
	T extends { pinned: boolean; starred: boolean; name: string; sortOrder: number }
>(rows: T[]): { pinned: T[]; starred: T[]; other: T[] } {
	const sorted = rows.slice().sort(compareDriveRows);
	return {
		pinned: sorted.filter((r) => r.pinned),
		starred: sorted.filter((r) => r.starred && !r.pinned),
		other: sorted.filter((r) => !r.pinned && !r.starred)
	};
}

export function colorLabel(c: string): string {
	return c.charAt(0).toUpperCase() + c.slice(1);
}

export function recentWhereLabel(item: RecentDriveItem): string {
	if (item.source === 'own') return 'My files';
	if (item.source === 'shared') return 'Shared with you';
	return item.teamName?.trim() || 'Team';
}

export function canEditRecentItem(item: RecentDriveItem): boolean {
	return item.source === 'own' || item.source === 'team';
}
