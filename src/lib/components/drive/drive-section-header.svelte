<script lang="ts">
	import { LucidePin, LucideStar } from '@lucide/svelte';

	let {
		colspan,
		label,
		icon = null as 'pin' | 'star' | null
	}: {
		colspan: number;
		label: string;
		icon?: 'pin' | 'star' | null;
	} = $props();
</script>

<tr class="bg-base-200/60 hover:bg-base-200/60">
	<td {colspan} class="py-2 text-xs font-semibold tracking-wide text-base-content/80 uppercase">
		{#if icon === 'pin'}
			<span class="inline-flex items-center gap-2">
				<LucidePin class="size-3.5" aria-hidden="true" />
				{label}
			</span>
		{:else if icon === 'star'}
			<span class="inline-flex items-center gap-2">
				<LucideStar class="size-3.5" aria-hidden="true" />
				{label}
			</span>
		{:else}
			<span class="text-base-content/80">{label}</span>
		{/if}
	</td>
</tr>
