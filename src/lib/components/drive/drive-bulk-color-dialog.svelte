<script lang="ts">
	import { FILE_LABEL_COLORS, fileLabelBadgeClass } from '$lib/model/file-label-color';
	import { colorLabel } from '$lib/components/drive/drive-item';
	import type { createDriveBulkActions } from '$lib/components/drive/use-drive-bulk-actions.svelte';

	type Bulk = ReturnType<typeof createDriveBulkActions>;

	let { bulk }: { bulk: Bulk } = $props();
</script>

<dialog
	bind:this={bulk.colorDialogEl}
	class="d-modal"
	onclose={() => {
		/* closed via bulk */
	}}
>
	<div class="d-modal-box max-w-md">
		<h3 class="d-font-title text-lg font-bold">Color</h3>
		<p class="py-2 text-sm text-base-content/70">Apply a label color to selected items.</p>
		<div class="mt-3 flex flex-wrap gap-2">
			{#each FILE_LABEL_COLORS as c (c)}
				<button
					type="button"
					class="{fileLabelBadgeClass(c)} cursor-pointer"
					disabled={bulk.busy}
					onclick={() => void bulk.pickBulkColor(c)}
				>
					{colorLabel(c)}
				</button>
			{/each}
		</div>
		<div class="mt-3">
			<button
				type="button"
				class="d-btn d-btn-ghost d-btn-sm"
				disabled={bulk.busy}
				onclick={() => void bulk.clearBulkColor()}
			>
				Clear color
			</button>
		</div>
		<div class="d-modal-action">
			<form method="dialog">
				<button type="submit" class="d-btn" disabled={bulk.busy}>Close</button>
			</form>
		</div>
	</div>
</dialog>
