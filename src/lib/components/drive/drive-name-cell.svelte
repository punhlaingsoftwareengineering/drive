<script lang="ts">
	import AppMarkIcon from '$lib/components/app-mark-icon.svelte';
	import { fileLabelIconClass } from '$lib/model/file-label-color';
	import { LucideFolder } from '@lucide/svelte';
	import type { DriveItem } from '$lib/components/drive/drive-item';

	let {
		item,
		onEnterFolder
	}: {
		item: DriveItem;
		onEnterFolder?: (item: DriveItem) => void;
	} = $props();
</script>

{#if item.itemType === 'folder'}
	<button
		type="button"
		class="inline-flex max-w-full min-w-0 items-center gap-2 text-left font-medium hover:underline"
		onclick={(e) => {
			e.stopPropagation();
			onEnterFolder?.(item);
		}}
	>
		<LucideFolder class="size-5 shrink-0 {fileLabelIconClass(item.color)}" aria-hidden="true" />
		<span class="truncate">{item.name}</span>
	</button>
{:else}
	<span class="inline-flex max-w-full min-w-0 items-center gap-2">
		<AppMarkIcon class="size-5 shrink-0 {fileLabelIconClass(item.color ?? 'base')}" />
		<span class="truncate font-medium">{item.name}</span>
	</span>
{/if}
