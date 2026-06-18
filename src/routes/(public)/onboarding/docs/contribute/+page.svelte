<script lang="ts">
	import { localizeHref } from '$lib/paraglide/runtime';
	import {
		LucideBookOpen,
		LucideFolderTree,
		LucideGitBranch,
		LucideLayers,
		LucideServerCog,
		LucideWorkflow
	} from '@lucide/svelte';

	const cards = [
		{
			href: '/onboarding/docs/contribute/stack',
			title: 'Stack',
			desc: 'SvelteKit 2, Svelte 5, Drizzle, Better Auth, DaisyUI, Paraglide.',
			Icon: LucideLayers
		},
		{
			href: '/onboarding/docs/contribute/repo-layout',
			title: 'Repository layout',
			desc: 'Routes, server lib, client lib, and database schema folders.',
			Icon: LucideFolderTree
		},
		{
			href: '/onboarding/docs/contribute/env-and-db',
			title: 'Environment and database',
			desc: '`.env`, Drizzle push/migrate, Neon.',
			Icon: LucideServerCog
		},
		{
			href: '/onboarding/docs/contribute/workflows',
			title: 'Workflows',
			desc: '`deno task dev`, `deno task check`, `deno task test`.',
			Icon: LucideWorkflow
		},
		{
			href: '/onboarding/docs/contribute/architecture',
			title: 'Architecture',
			desc: 'Auth → handlers → storage, high-level flow.',
			Icon: LucideGitBranch
		}
	] as const;
</script>

<svelte:head>
	<title>Contribute · Documentation · ZNL-DRIVE</title>
	<meta
		name="description"
		content="Run the project locally: stack, repo layout, env, workflows, architecture."
	/>
</svelte:head>

<div class="not-prose mx-auto max-w-4xl">
	<h1 class="mb-2 text-3xl font-bold text-base-content">Contribute</h1>
	<p class="mb-10 text-lg text-base-content/70">
		Run the app locally, match existing patterns, and land changes with the same checks CI uses.
	</p>

	<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each cards as c (c.href)}
			<li>
				<a
					href={localizeHref(c.href)}
					class="d-card flex h-full flex-col rounded-box border border-base-200 bg-base-200/40 p-5 shadow-sm transition-colors hover:border-accent/40"
				>
					<c.Icon class="mb-3 size-9 text-accent" aria-hidden="true" />
					<h2 class="text-lg font-semibold">{c.title}</h2>
					<p class="mt-2 text-sm text-base-content/65">{c.desc}</p>
				</a>
			</li>
		{/each}
	</ul>

	<p class="mt-10 flex items-start gap-2 text-sm text-base-content/60">
		<LucideBookOpen class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
		Start with <strong>Stack</strong> and <strong>Repository layout</strong> if you are new to the codebase.
	</p>
</div>
