<script lang="ts">
	import { appName, appTitle } from '$lib/app-name';
	import { localizeHref } from '$lib/paraglide/runtime';
	import {
		LucideFolderOpen,
		LucideHardDrive,
		LucideLink2,
		LucideSettings,
		LucideShare2,
		LucideTrash2,
		LucideUpload
	} from '@lucide/svelte';

	const pages = [
		{
			href: '/onboarding/docs/user/getting-started',
			title: 'Getting started',
			desc: 'Sign in, navigate Home, and learn the basics.',
			Icon: LucideFolderOpen
		},
		{
			href: '/onboarding/docs/user/files-and-folders',
			title: 'Files and folders',
			desc: 'Browse, labels, pin, star, and breadcrumbs.',
			Icon: LucideFolderOpen
		},
		{
			href: '/onboarding/docs/user/upload-and-download',
			title: 'Upload and download',
			desc: 'NEW menu, uploads, and downloading files or ZIPs.',
			Icon: LucideUpload
		},
		{
			href: '/onboarding/docs/user/shared',
			title: 'Shared with you',
			desc: 'What appears under Shared and how access works.',
			Icon: LucideShare2
		},
		{
			href: '/onboarding/docs/user/trash',
			title: 'Trash',
			desc: 'Moving items to trash and what it means.',
			Icon: LucideTrash2
		},
		{
			href: '/onboarding/docs/user/public-links',
			title: 'Public links',
			desc: 'Anonymous preview links and direct file URLs for every file type.',
			Icon: LucideLink2
		},
		{
			href: '/onboarding/docs/user/storage-providers',
			title: 'Storage providers',
			desc: 'Local vs cloud in the top bar, including team drive behavior.',
			Icon: LucideHardDrive
		},
		{
			href: '/onboarding/docs/user/settings',
			title: 'Settings',
			desc: 'Theme, font, text size, language, and filtering the settings list.',
			Icon: LucideSettings
		}
	] as const;
</script>

<svelte:head>
	<title>{appTitle('User manual · Documentation')}</title>
	<meta
		name="description"
		content="How to use {appName()}: home, teams, files, sharing, trash, public links, and settings."
	/>
</svelte:head>

<div class="not-prose mx-auto max-w-4xl">
	<h1 class="mb-2 text-3xl font-bold text-base-content">User manual</h1>
	<p class="mb-10 text-lg text-base-content/70">
		Learn how to use {appName()} day to day: organize files, collaborate, and tune the app to your preferences.
	</p>

	<ul class="grid gap-3 sm:grid-cols-2">
		{#each pages as p (p.href)}
			<li>
				<a
					href={localizeHref(p.href)}
					class="d-card flex h-full flex-row items-start gap-3 rounded-box border border-base-200 bg-base-200/40 p-4 shadow-sm transition-colors hover:border-primary/30"
				>
					<p.Icon class="mt-0.5 size-8 shrink-0 text-primary" aria-hidden="true" />
					<div>
						<h2 class="font-semibold">{p.title}</h2>
						<p class="mt-1 text-sm text-base-content/65">{p.desc}</p>
					</div>
				</a>
			</li>
		{/each}
	</ul>
</div>
