import { afterNavigate } from '$app/navigation';
import { browser } from '$app/environment';
import { registerDriveListReload } from '$lib/state/drive-refresh.svelte';
import { onMount } from 'svelte';

/** Registers list reload + navigates; avoids duplicate onMount + afterNavigate fetch. */
export function useDriveListLoader(loadFn: () => void | Promise<void>): void {
	onMount(() => registerDriveListReload(() => void loadFn()));
	afterNavigate(() => {
		if (browser) void loadFn();
	});
}
