import { bumpDriveListRefresh } from '$lib/state/drive-refresh.svelte';
import {
	STORAGE_PROVIDER_STORAGE_KEY,
	type StorageProviderId,
	parseStorageProvider
} from '$lib/model/storage-provider';

/** Navbar + upload target — mutate `.current` only (Svelte: no reassigned exported `$state`). */
export const driveStorage = $state<{ current: StorageProviderId }>({ current: 'local' });

export function hydrateStorageProviderFromStorage(): void {
	if (typeof localStorage === 'undefined') return;
	const p = parseStorageProvider(localStorage.getItem(STORAGE_PROVIDER_STORAGE_KEY));
	if (p && p !== driveStorage.current) {
		driveStorage.current = p;
		bumpDriveListRefresh();
	} else if (p) {
		driveStorage.current = p;
	}
}

export function setCurrentStorageProvider(v: StorageProviderId): void {
	driveStorage.current = v;
	localStorage.setItem(STORAGE_PROVIDER_STORAGE_KEY, v);
	bumpDriveListRefresh();
}
