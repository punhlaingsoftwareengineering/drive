<script lang="ts">
	let {
		checked = false,
		indeterminate = false,
		disabled = false,
		ariaLabel,
		onchange
	}: {
		checked?: boolean;
		indeterminate?: boolean;
		disabled?: boolean;
		ariaLabel: string;
		onchange?: (e: Event) => void;
	} = $props();

	let inputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (inputEl) inputEl.indeterminate = indeterminate;
	});
</script>

<input
	bind:this={inputEl}
	type="checkbox"
	class="d-checkbox d-checkbox-sm"
	{checked}
	{disabled}
	aria-label={ariaLabel}
	onclick={(e) => e.stopPropagation()}
	onchange={onchange}
/>
