<script lang="ts">
	import { appName, appTitle } from '$lib/app-name';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { LucideKeyRound, LucideListTree, LucideTriangleAlert } from '@lucide/svelte';

	const cards = [
		{
			href: '/onboarding/docs/developer/authentication',
			title: 'Authentication',
			desc: 'Cookie sessions, developer API keys (`znldv_…`), and when Bearer vs browser-only applies.',
			Icon: LucideKeyRound
		},
		{
			href: '/onboarding/docs/developer/rest-api',
			title: 'REST API reference',
			desc: 'Method and path catalog for `api/auth`, `api/teams`, `api/drive`, `api/developer`, `api/public`, and cron.',
			Icon: LucideListTree
		},
		{
			href: '/onboarding/docs/developer/errors',
			title: 'Errors',
			desc: 'Typical 401, 403, 503 responses across drive and developer routes.',
			Icon: LucideTriangleAlert
		}
	] as const;
</script>

<svelte:head>
	<title>{appTitle('Developer · Documentation')}</title>
	<meta
		name="description"
		content="Authentication, REST API catalog, and errors for {appName()} integrations."
	/>
</svelte:head>

<div class="not-prose mx-auto max-w-4xl">
	<h1 class="mb-2 text-3xl font-bold text-base-content">Developer</h1>
	<p class="mb-10 text-lg text-base-content/70">
		Integrate with {appName()} over HTTP: authenticate like the web app or with a developer API key, then
		call the drive JSON and binary endpoints.
	</p>

	<ul class="grid gap-4 sm:grid-cols-3">
		{#each cards as c (c.href)}
			<li>
				<a
					href={localizeHref(c.href)}
					class="d-card flex h-full flex-col rounded-box border border-base-200 bg-base-200/40 p-5 shadow-sm transition-colors hover:border-secondary/40"
				>
					<c.Icon class="mb-3 size-9 text-secondary" aria-hidden="true" />
					<h2 class="text-lg font-semibold">{c.title}</h2>
					<p class="mt-2 text-sm text-base-content/65">{c.desc}</p>
				</a>
			</li>
		{/each}
	</ul>
</div>
