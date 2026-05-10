<script lang="ts">
	import { browser } from '$app/environment';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { enhanceDocsMermaid } from '$lib/docs/mermaid-docs';
	import {
		DOCS_ROOT,
		docsCanonicalPath,
		findDocsBreadcrumbChain,
		flattenDocsNav,
		isDocsNavItemActive
	} from '$lib/docs/nav';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { LucideBookOpen, LucideMenu } from '@lucide/svelte';
	import { tick } from 'svelte';

	let { children } = $props();

	let docsContentEl = $state<HTMLElement | null>(null);

	const drawerId = 'docs-drawer-nav';

	const canonicalPath = $derived(docsCanonicalPath(page.url.pathname));
	const flatNav = $derived(flattenDocsNav());
	const breadcrumbChain = $derived(findDocsBreadcrumbChain(canonicalPath) ?? []);

	afterNavigate(async () => {
		if (!browser || !docsContentEl) return;
		await tick();
		await enhanceDocsMermaid(docsContentEl);
	});
</script>

<svelte:head>
	<title>Documentation · ZNL-DRIVE</title>
	<meta
		name="description"
		content="ZNL-DRIVE user manual, developer API reference, and contributor guide."
	/>
</svelte:head>

<div class="d-drawer min-h-[100dvh] lg:d-drawer-open">
	<input id={drawerId} type="checkbox" class="peer/drawer d-drawer-toggle" />
	<div class="d-drawer-content flex min-h-[100dvh] flex-col bg-base-100">
		<div class="d-navbar sticky top-0 z-30 border-b border-base-200 bg-base-100/95 backdrop-blur">
			<div class="flex-none lg:hidden">
				<label for={drawerId} class="d-btn d-btn-square d-btn-ghost" aria-label="Open sidebar">
					<LucideMenu class="size-5" />
				</label>
			</div>
			<div class="flex flex-1 items-center gap-2 px-2">
				<a href={localizeHref('/onboarding')} class="d-btn px-2 text-lg font-semibold d-btn-ghost">
					ZNL-DRIVE
				</a>
				<span class="hidden text-base-content/40 sm:inline">/</span>
				<span class="flex items-center gap-1 text-sm font-medium text-base-content/80">
					<LucideBookOpen class="size-4 shrink-0 opacity-70" aria-hidden="true" />
					Docs
				</span>
			</div>
			<div class="hidden flex-none sm:block">
				<a href={localizeHref('/home')} class="d-btn d-btn-ghost d-btn-sm">Open app</a>
			</div>
		</div>

		<main class="flex min-h-0 flex-1 flex-col">
			<div class="border-b border-base-200 bg-base-200/30 px-4 py-3 lg:px-8">
				<nav class="d-breadcrumbs text-sm" aria-label="Breadcrumb">
					<ul>
						<li>
							{#if canonicalPath === DOCS_ROOT}
								<span class="font-medium">Overview</span>
							{:else}
								<a href={localizeHref(DOCS_ROOT)}>Documentation</a>
							{/if}
						</li>
						{#if canonicalPath !== DOCS_ROOT}
							{#each breadcrumbChain as crumb, i (crumb.path)}
								<li>
									{#if i < breadcrumbChain.length - 1}
										<a href={localizeHref(crumb.path)}>{crumb.title}</a>
									{:else}
										<span class="font-medium">{crumb.title}</span>
									{/if}
								</li>
							{/each}
						{/if}
					</ul>
				</nav>
			</div>

			<div
				bind:this={docsContentEl}
				id="docs-prose-root"
				class="[&_a]:link-primary prose prose-sm max-w-none flex-1 px-4 py-8 lg:px-10 dark:prose-invert"
			>
				{@render children()}
			</div>

			<footer
				class="mt-auto border-t border-base-200 px-4 py-6 text-center text-xs text-base-content/50 lg:px-8"
			>
				ZNL-DRIVE documentation — DaisyUI + Tailwind Typography
			</footer>
		</main>
	</div>

	<div class="d-drawer-side z-40 h-full max-h-[100dvh] border-r border-base-200">
		<label for={drawerId} class="d-drawer-overlay" aria-label="Close menu"></label>
		<aside
			class="flex h-full w-72 max-w-[85vw] flex-col gap-2 overflow-y-auto bg-base-200/80 pt-4 pb-8 backdrop-blur"
		>
			<div class="px-4 pb-2">
				<p class="text-xs font-semibold tracking-wide text-base-content/60 uppercase">
					On this site
				</p>
			</div>
			<ul class="d-menu w-full gap-0.5 d-menu-md px-2">
				{#each flatNav as entry (entry.path)}
					<li>
						<a
							href={localizeHref(entry.path)}
							class="rounded-lg {isDocsNavItemActive(canonicalPath, entry.path)
								? 'd-menu-active font-medium'
								: ''}"
							style="padding-left: {0.75 + entry.depth * 0.75}rem"
						>
							{entry.title}
						</a>
					</li>
				{/each}
			</ul>
		</aside>
	</div>
</div>
