<script lang="ts">
	import { LucidePin, LucideStar } from '@lucide/svelte';
	import type { DriveItem } from '$lib/components/drive/drive-item';

	let {
		item,
		busyId = null,
		editable = true,
		onTogglePin,
		onToggleStar
	}: {
		item: DriveItem;
		busyId?: string | null;
		editable?: boolean;
		onTogglePin?: (item: DriveItem) => void;
		onToggleStar?: (item: DriveItem) => void;
	} = $props();
</script>

<td class="text-center">
	{#if editable}
		<button
			type="button"
			class="d-btn d-btn-square d-btn-ghost d-btn-sm"
			aria-pressed={item.pinned}
			aria-label={item.pinned ? 'Unpin' : 'Pin'}
			disabled={busyId === item.id}
			onclick={() => onTogglePin?.(item)}
		>
			<LucidePin class="size-4 {item.pinned ? 'text-primary' : 'text-base-content/30'}" />
		</button>
	{:else}
		<span
			class="inline-flex justify-center"
			title={item.pinned ? 'Pinned by owner' : 'Not pinned'}
			aria-hidden="true"
		>
			<LucidePin class="size-4 {item.pinned ? 'text-primary' : 'text-base-content/15'}" />
		</span>
	{/if}
</td>
<td class="text-center">
	{#if editable}
		<button
			type="button"
			class="d-btn d-btn-square d-btn-ghost d-btn-sm"
			aria-pressed={item.starred}
			aria-label={item.starred ? 'Unstar' : 'Star'}
			disabled={busyId === item.id}
			onclick={() => onToggleStar?.(item)}
		>
			<LucideStar
				class="size-4 {item.starred ? 'fill-warning text-warning' : 'text-base-content/30'}"
			/>
		</button>
	{:else}
		<span
			class="inline-flex justify-center"
			title={item.starred ? 'Starred by owner' : 'Not starred'}
			aria-hidden="true"
		>
			<LucideStar
				class="size-4 {item.starred ? 'fill-warning text-warning' : 'text-base-content/15'}"
			/>
		</span>
	{/if}
</td>
