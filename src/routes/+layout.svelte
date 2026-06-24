<script lang="ts">
	import { page } from '$app/state';
	import { appName } from '$lib/app-name';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import './layout.css';
	import Favicon from '$lib/asset/favicon.svg';
	import { ToastState } from '$lib/state/toast.state.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={Favicon} />
	<title>{appName()}</title>
</svelte:head>
{@render children()}

<div style="display:none" class="bg-base-100">
	{#each locales as locale}
		<a href={localizeHref(page.url.pathname, { locale })}>{locale}</a>
	{/each}
</div>

<!-- Toast Component when no dialog is open (Learn Toast Service To Use) -->
{#if ToastState.length > 0}
	<div class="d-toast d-toast-end d-toast-bottom">
		{#each ToastState as toast (toast.id)}
			<div>
				<div class="d-alert d-alert-{toast.type}">
					<div class="d-alert-message">{toast.message}</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
