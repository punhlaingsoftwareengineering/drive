<script lang="ts">
	let {
		loading = false,
		hasRows = false,
		loadError = null as string | null
	}: {
		loading?: boolean;
		hasRows?: boolean;
		loadError?: string | null;
	} = $props();
</script>

{#if loading && !hasRows}
	<div class="h-40 w-full d-skeleton"></div>
{:else if loadError}
	<div class="d-alert d-alert-error">
		<span>{loadError}</span>
	</div>
{/if}
