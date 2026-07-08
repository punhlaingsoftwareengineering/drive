<script lang="ts">
	import {
		LucideDownload,
		LucideFolderInput,
		LucidePalette,
		LucidePin,
		LucideRotateCcw,
		LucideStar,
		LucideTrash2,
		LucideX
	} from '@lucide/svelte';

	let {
		count,
		busy = false,
		showDownload = true,
		showTrash = false,
		showRestore = false,
		showDeleteForever = false,
		showPin = false,
		showStar = false,
		showColor = false,
		showMove = false,
		onClear,
		onDownload,
		onTrash,
		onRestore,
		onDeleteForever,
		onPin,
		onStar,
		onColor,
		onMove
	}: {
		count: number;
		busy?: boolean;
		showDownload?: boolean;
		showTrash?: boolean;
		showRestore?: boolean;
		showDeleteForever?: boolean;
		showPin?: boolean;
		showStar?: boolean;
		showColor?: boolean;
		showMove?: boolean;
		onClear: () => void;
		onDownload?: () => void;
		onTrash?: () => void;
		onRestore?: () => void;
		onDeleteForever?: () => void;
		onPin?: () => void;
		onStar?: () => void;
		onColor?: () => void;
		onMove?: () => void;
	} = $props();
</script>

{#if count > 0}
	<div
		class="d-alert sticky top-0 z-20 mb-2 shrink-0 border border-primary/30 bg-primary/10 shadow-sm"
		role="toolbar"
		aria-label="{count} item(s) selected"
	>
		<span class="font-medium">{count} selected</span>
		<div class="flex flex-wrap items-center gap-1">
			{#if showDownload && onDownload}
				<button
					type="button"
					class="d-btn d-btn-ghost d-btn-sm gap-1"
					disabled={busy}
					onclick={onDownload}
				>
					<LucideDownload class="size-4" />
					Download
				</button>
			{/if}
			{#if showMove && onMove}
				<button type="button" class="d-btn d-btn-ghost d-btn-sm gap-1" disabled={busy} onclick={onMove}>
					<LucideFolderInput class="size-4" />
					Move to…
				</button>
			{/if}
			{#if showPin && onPin}
				<button type="button" class="d-btn d-btn-ghost d-btn-sm gap-1" disabled={busy} onclick={onPin}>
					<LucidePin class="size-4" />
					Pin
				</button>
			{/if}
			{#if showStar && onStar}
				<button type="button" class="d-btn d-btn-ghost d-btn-sm gap-1" disabled={busy} onclick={onStar}>
					<LucideStar class="size-4" />
					Star
				</button>
			{/if}
			{#if showColor && onColor}
				<button
					type="button"
					class="d-btn d-btn-ghost d-btn-sm gap-1"
					disabled={busy}
					onclick={onColor}
				>
					<LucidePalette class="size-4" />
					Color
				</button>
			{/if}
			{#if showRestore && onRestore}
				<button
					type="button"
					class="d-btn d-btn-ghost d-btn-sm gap-1"
					disabled={busy}
					onclick={onRestore}
				>
					<LucideRotateCcw class="size-4" />
					Restore
				</button>
			{/if}
			{#if showTrash && onTrash}
				<button type="button" class="d-btn d-btn-ghost d-btn-sm gap-1" disabled={busy} onclick={onTrash}>
					<LucideTrash2 class="size-4" />
					Move to trash
				</button>
			{/if}
			{#if showDeleteForever && onDeleteForever}
				<button
					type="button"
					class="d-btn d-btn-error d-btn-ghost d-btn-sm gap-1"
					disabled={busy}
					onclick={onDeleteForever}
				>
					<LucideTrash2 class="size-4" />
					Delete forever
				</button>
			{/if}
			<button
				type="button"
				class="d-btn d-btn-ghost d-btn-sm d-btn-square"
				aria-label="Clear selection"
				disabled={busy}
				onclick={onClear}
			>
				<LucideX class="size-4" />
			</button>
		</div>
	</div>
{/if}
