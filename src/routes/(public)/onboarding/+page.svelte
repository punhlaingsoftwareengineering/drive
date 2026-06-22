<script>
	import OnboardingHeroCarousel from '$lib/components/onboarding-hero-carousel.svelte';
	import { localizeHref } from '$lib/paraglide/runtime';
	import {
		LucideArchive,
		LucideCable,
		LucideCloud,
		LucideHardDrive,
		LucideStar,
		LucideUsers
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
</script>

<section class="my-20 flex flex-col gap-20">
	<section id="hero" class="my-12 flex flex-col items-center gap-10 lg:flex-row lg:justify-between lg:gap-12">
		<div class="max-w-xl shrink-0">
			<h1 class="icon-font text-5xl font-black">Storage As A Service</h1>
			<p class="my-ft-lead">a portable service that integrates into your workflow.</p>

			<div class="mt-10 flex flex-wrap gap-3 sm:gap-5">
				<a class="d-btn d-btn-primary" href={resolve('/(private)/home')}>Get Started</a>

				<a
					class="d-btn d-btn-outline"
					href="https://github.com/zarnihlawn/znl-drive"
					target="_blank"
					rel="noopener noreferrer"
				>
					Host Your Own
				</a>
			</div>
		</div>
		<div class="min-w-0 flex-1">
			<OnboardingHeroCarousel />
		</div>
	</section>

	<div class="my-ft-body-lg d-divider">Features</div>

	<section id="features" class="flex justify-between gap-20">
		<div class="d-card w-96 bg-base-100 shadow-sm">
			<figure class="px-10 pt-10">
				<LucideHardDrive class="size-28 text-primary" />
			</figure>
			<div class="d-card-body items-center text-center">
				<h2 class="d-card-title">Local Drive</h2>
				<p>
					Keep files on your own machine or server. Pick local storage in the app and uploads land on
					disk under your control—ideal for development, air‑gapped setups, or when you want zero
					vendor lock‑in.
				</p>
			</div>
		</div>
		<div class="d-card w-96 bg-base-100 shadow-sm">
			<figure class="px-10 pt-10">
				<LucideCloud class="size-28 text-secondary" />
			</figure>
			<div class="d-card-body items-center text-center">
				<h2 class="d-card-title">Cloud Storage</h2>
				<p>
					Plug in S3‑compatible object storage (for example Tigris) so blobs live in the cloud while
					metadata stays in your database. Same UI and APIs—switch providers per environment or team.
				</p>
			</div>
		</div>
		<div class="d-card w-96 bg-base-100 shadow-sm">
			<figure class="px-10 pt-10">
				<LucideCable class="size-28 text-info" />
			</figure>
			<div class="d-card-body items-center text-center">
				<h2 class="d-card-title">API</h2>
				<p>
					Automate uploads, shares, and downloads with REST endpoints. Use your browser session or a
					developer API key—documented under Docs → Developer so scripts and backends integrate
					cleanly.
				</p>
			</div>
		</div>
	</section>

	<div class="my-ft-body-lg d-divider">Stats</div>

	<div class="d-stats bg-base-100 py-5">
		<div class="d-stat">
			<div class="d-stat-figure text-secondary">
				<LucideUsers class="size-12 text-primary" />
			</div>
			<div class="d-stat-title">Users</div>
			<div class="d-stat-value">31K</div>
			<div class="d-stat-desc">Jan 1st - Feb 1st</div>
		</div>

		<div class="d-stat">
			<div class="d-stat-figure text-secondary">
				<LucideArchive class="size-12 text-secondary" />
			</div>
			<div class="d-stat-title">Usage</div>
			<div class="d-stat-value">4,200</div>
			<div class="d-stat-desc">↗︎ 400 (22%)</div>
		</div>

		<div class="d-stat">
			<div class="d-stat-figure text-secondary">
				<LucideStar class="size-12 text-info" />
			</div>
			<div class="d-stat-title">GitHub Stars</div>
			<div class="d-stat-value">1,200</div>
			<div class="d-stat-desc">↘︎ 90 (14%)</div>
		</div>
	</div>
</section>
