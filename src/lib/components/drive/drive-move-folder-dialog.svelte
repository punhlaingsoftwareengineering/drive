<script lang="ts">
	import { LucideChevronRight, LucideFolder } from '@lucide/svelte';
	import { fetchWithSession } from '$lib/client/fetch-session';
	import { resolveHref } from '$lib/url/resolve-href';
	import { mapApiFile, type ApiDriveFile } from '$lib/components/drive/drive-item';
	import type { StorageProviderId } from '$lib/model/storage-provider';

	let {
		storageProvider,
		teamId = undefined,
		excludeIds = [],
		onSelect,
		onClose
	}: {
		storageProvider: StorageProviderId;
		teamId?: string;
		excludeIds?: string[];
		onSelect: (parentId: string | null) => void;
		onClose?: () => void;
	} = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	let browseParentId = $state<string | null>(null);
	let folders = $state<{ id: string; name: string }[]>([]);
	let loading = $state(false);
	let errorMsg = $state<string | null>(null);
	const excludeSet = $derived(new Set(excludeIds));

	async function loadFolders(parentId: string | null) {
		loading = true;
		errorMsg = null;
		try {
			const qs = new URLSearchParams({ storageProvider });
			if (parentId) qs.set('parentId', parentId);
			if (teamId) qs.set('teamId', teamId);
			const r = await fetchWithSession(`${resolveHref('/api/drive/files')}?${qs}`);
			if (!r.ok) throw new Error((await r.text()) || r.statusText);
			const payload = (await r.json()) as { files: ApiDriveFile[] };
			folders = payload.files
				.filter((f) => f.itemType === 'folder' && !excludeSet.has(f.id))
				.map((f) => mapApiFile(f))
				.map((f) => ({ id: f.id, name: f.name }));
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Failed to load folders';
			folders = [];
		} finally {
			loading = false;
		}
	}

	function openAt(parentId: string | null) {
		browseParentId = parentId;
		void loadFolders(parentId);
	}

	function onDialogClose() {
		onClose?.();
	}

	export function show(initialParentId: string | null = null) {
		openAt(initialParentId);
		dialogEl?.showModal();
	}
</script>

<dialog bind:this={dialogEl} class="d-modal" onclose={onDialogClose}>
	<div class="d-modal-box max-w-md">
		<h3 class="text-lg font-bold">Move to folder</h3>
		<p class="py-2 text-sm text-base-content/70">Choose a destination folder.</p>

		{#if errorMsg}
			<p class="d-alert d-alert-error text-sm">{errorMsg}</p>
		{/if}

		<div class="flex flex-col gap-1 py-2">
			<button
				type="button"
				class="d-btn d-btn-ghost justify-start gap-2"
				disabled={loading}
				onclick={() => onSelect(null)}
			>
				<LucideFolder class="size-4" />
				Root folder
			</button>
			{#each folders as folder (folder.id)}
				<div class="flex items-center gap-1">
					<button
						type="button"
						class="d-btn min-w-0 flex-1 d-btn-ghost justify-start gap-2"
						disabled={loading}
						onclick={() => onSelect(folder.id)}
					>
						<LucideFolder class="size-4 shrink-0" />
						<span class="truncate">{folder.name}</span>
					</button>
					<button
						type="button"
						class="d-btn d-btn-square d-btn-ghost d-btn-sm"
						aria-label="Open {folder.name}"
						disabled={loading}
						onclick={() => openAt(folder.id)}
					>
						<LucideChevronRight class="size-4" />
					</button>
				</div>
			{/each}
			{#if !loading && folders.length === 0}
				<p class="text-sm text-base-content/60">No subfolders here.</p>
			{/if}
		</div>

		<div class="d-modal-action">
			<form method="dialog">
				<button type="submit" class="d-btn">Cancel</button>
			</form>
		</div>
	</div>
	<form method="dialog" class="d-modal-backdrop">
		<button type="submit" aria-label="Close">close</button>
	</form>
</dialog>
