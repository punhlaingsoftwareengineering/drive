<script lang="ts">
	import { appTitle } from '$lib/app-name';
	let { children } = $props();
</script>

<svelte:head>
	<title>{appTitle('Auth', ' | ')}</title>
</svelte:head>

<div class="my-app my-dotted-background-teal">
	<div class="my-main">
		{@render children?.()}
	</div>
</div>
