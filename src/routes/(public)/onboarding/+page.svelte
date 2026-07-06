<script>
	import AppMarkIcon from '$lib/components/app-mark-icon.svelte';
	import OnboardingHeroCarousel from '$lib/components/onboarding-hero-carousel.svelte';
	import { appName } from '$lib/app-name';
	import { localizeHref } from '$lib/paraglide/runtime';
	import {
		LucideCable,
		LucideCloud,
		LucideHardDrive
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
</script>

<section class="my-20 flex flex-col gap-20">
	<section
		id="hero"
		class="my-12 grid items-center gap-12 lg:grid-cols-2 lg:gap-16"
	>
		<div class="max-w-xl">
			<h1 class="icon-font text-3xl font-black leading-tight tracking-tight sm:text-4xl">
				Storage As A Service
			</h1>
			<p class="my-ft-lead mt-4">a portable service that integrates into your workflow.</p>

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

		<div class="flex justify-center lg:justify-end">
			<AppMarkIcon
				class="size-48 text-[#DE1A58] sm:size-64 lg:size-80 xl:size-96"
				title={appName()}
			/>
		</div>
	</section>

	<section class="mt-8">
		<OnboardingHeroCarousel />
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
					Keep files on your own machine or server. Pick local storage in the app and uploads land
					on disk under your control—ideal for development, air‑gapped setups, or when you want zero
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
					metadata stays in your database. Same UI and APIs—switch providers per environment or
					team.
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
</section>
