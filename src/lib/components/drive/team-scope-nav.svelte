<script lang="ts">
	import { resolveHref } from '$lib/url/resolve-href';
	import type { TeamScopeView } from '$lib/model/team-scope';
	import {
		LucideClock,
		LucideHouse,
		LucideLayoutDashboard,
		LucideSettings,
		LucideShare,
		LucideTrash
	} from '@lucide/svelte';

	type TeamView = {
		slug: string;
		name: string;
	};

	let {
		team,
		activeView
	}: {
		team: TeamView;
		activeView: TeamScopeView;
	} = $props();

	const base = $derived(resolveHref(`/home/team/${team.slug}`));

	const items = $derived([
		{ view: 'home' as const, href: base, label: 'Home', icon: LucideHouse, btnClass: 'd-btn-primary' },
		{
			view: 'shared' as const,
			href: `${base}/shared`,
			label: 'Shared',
			icon: LucideShare,
			btnClass: 'd-btn-secondary'
		},
		{
			view: 'recent' as const,
			href: `${base}/recent`,
			label: 'Recent',
			icon: LucideClock,
			btnClass: 'd-btn-accent'
		},
		{
			view: 'trash' as const,
			href: `${base}/trash`,
			label: 'Trash',
			icon: LucideTrash,
			btnClass: 'd-btn-error'
		},
		{
			view: 'dashboard' as const,
			href: `${base}/dashboard`,
			label: 'Dashboard',
			icon: LucideLayoutDashboard,
			btnClass: 'd-btn-success'
		},
		{
			view: 'settings' as const,
			href: `${base}/settings`,
			label: 'Settings',
			icon: LucideSettings,
			btnClass: 'd-btn-neutral'
		}
	]);
</script>

<nav
	class="flex shrink-0 flex-wrap gap-2 rounded-lg border border-base-300 bg-base-100/80 p-3"
	aria-label="{team.name} drive sections"
>
	{#each items as item (item.view)}
		<a
			class="d-btn d-btn-sm d-btn-ghost d-btn-outline {item.btnClass} {activeView === item.view
				? 'd-btn-active'
				: ''}"
			href={item.href}
			aria-current={activeView === item.view ? 'page' : undefined}
		>
			<item.icon class="size-4" aria-hidden="true" />
			{item.label}
		</a>
	{/each}
</nav>
