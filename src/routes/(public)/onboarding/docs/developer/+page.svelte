<script lang="ts">
	import { appName, appTitle } from '$lib/app-name';
	import { localizeHref } from '$lib/paraglide/runtime';
	import {
		LucideBookOpen,
		LucideFolderTree,
		LucideKeyRound,
		LucideListTree,
		LucideRocket,
		LucideRoute,
		LucideTriangleAlert,
		LucideUsers,
		LucideRepeat
	} from '@lucide/svelte';

	const cards = [
		{
			href: '/onboarding/docs/developer/getting-started',
			title: 'Getting started',
			desc: 'Base URL, enable developer mode, create an API key, and run your first authenticated request.',
			Icon: LucideRocket
		},
		{
			href: '/onboarding/docs/developer/authentication',
			title: 'Authentication',
			desc: 'Cookie sessions, developer API keys (`znldv_…`), headers, and which routes accept keys.',
			Icon: LucideKeyRound
		},
		{
			href: '/onboarding/docs/developer/conventions',
			title: 'Conventions',
			desc: 'JSON rules, UUIDs, storage providers, team scoping, dates, errors, and versioning policy.',
			Icon: LucideBookOpen
		},
		{
			href: '/onboarding/docs/developer/rest-api',
			title: 'REST API reference',
			desc: 'Complete endpoint index with auth and content-type columns.',
			Icon: LucideListTree
		},
		{
			href: '/onboarding/docs/developer/drive-api',
			title: 'Drive API',
			desc: 'Full contracts for files, folders, upload, trash, stats, sharing, and public links.',
			Icon: LucideFolderTree
		},
		{
			href: '/onboarding/docs/developer/teams-api',
			title: 'Teams API',
			desc: 'List teams, create teams, and send invites — all via API key.',
			Icon: LucideUsers
		},
		{
			href: '/onboarding/docs/developer/other-endpoints',
			title: 'Other endpoints',
			desc: 'Auth, developer admin, public token routes, and cron purge.',
			Icon: LucideRoute
		},
		{
			href: '/onboarding/docs/developer/workflows',
			title: 'Workflows',
			desc: 'End-to-end recipes: uploads, team drives, sharing, public links, and trash.',
			Icon: LucideRepeat
		},
		{
			href: '/onboarding/docs/developer/errors',
			title: 'Errors',
			desc: 'Status codes, example bodies, and client handling across drive and developer routes.',
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
		Integrate with {appName()} over HTTP: authenticate with a developer API key or browser session, then
		call the drive JSON and binary endpoints. Every drive and teams feature available in the UI is
		exposed to API keys.
	</p>

	<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
