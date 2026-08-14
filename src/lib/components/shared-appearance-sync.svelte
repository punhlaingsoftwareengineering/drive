<script lang="ts">
	import { onMount } from 'svelte';
	import { syncSharedAppearance } from '$lib/client/display-preferences';

	onMount(() => {
		syncSharedAppearance();
		const sync = () => syncSharedAppearance();
		window.addEventListener('focus', sync);
		document.addEventListener('visibilitychange', sync);
		window.addEventListener('storage', sync);
		return () => {
			window.removeEventListener('focus', sync);
			document.removeEventListener('visibilitychange', sync);
			window.removeEventListener('storage', sync);
		};
	});
</script>
