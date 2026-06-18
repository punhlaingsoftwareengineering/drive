<script lang="ts">
	import { resolve } from '$app/paths';
	import { appName, appTitle } from '$lib/app-name';
	import {
		LucideBuilding2,
		LucideCheck,
		LucideCloud,
		LucideGauge,
		LucideHardDrive,
		LucideHeadphones,
		LucideShieldCheck,
		LucideSparkles
	} from '@lucide/svelte';

	const signupHref = resolve('/(public)/auth/signup');
	const quoteHref =
		'https://github.com/zarnihlawn/znl-drive/issues/new?title=Enterprise%20quote%20request';

	const corePlans = [
		{
			id: 'free',
			name: 'Free',
			price: '$0',
			period: 'Always free',
			tagline: 'Every new account starts here. No plan selected? You are on Free.',
			badge: 'Default',
			badgeVariant: 'd-badge-success' as const,
			highlight: false,
			local: '10 MB',
			tigris: '1 GB',
			features: [
				'Local and Tigris storage providers',
				'Standard upload & folder workflows',
				'Community documentation',
				'Best for trying the product'
			],
			cta: 'Create free account',
			ctaVariant: 'd-btn-outline' as const
		},
		{
			id: 'starter',
			name: 'Starter',
			price: '$12',
			period: 'per user / month',
			tagline: 'More cloud headroom for individuals and small teams.',
			badge: 'Popular',
			badgeVariant: 'd-badge-primary' as const,
			highlight: true,
			local: '10 MB',
			tigris: '5 GB',
			features: [
				'Everything in Free',
				'Higher Tigris quota for daily use',
				'Email support (business hours)',
				'Usage visibility in the app'
			],
			cta: 'Start with Starter',
			ctaVariant: 'd-btn-primary' as const
		},
		{
			id: 'professional',
			name: 'Professional',
			price: '$39',
			period: 'per user / month',
			tagline: 'Extra local cache plus double the cloud quota.',
			badge: 'Pro',
			badgeVariant: 'd-badge-secondary' as const,
			highlight: false,
			local: '20 MB',
			tigris: '10 GB',
			features: [
				'Everything in Starter',
				'Expanded local workspace',
				'Priority email support',
				'Suitable for power users and growing teams'
			],
			cta: 'Choose Professional',
			ctaVariant: 'd-btn-primary' as const
		}
	] as const;

	const faq = [
		{
			q: 'What plan am I on if I never choose one?',
			a: 'All accounts default to the Free plan. Storage limits for local disk and Tigris apply as shown above until you upgrade or move to a custom agreement.'
		},
		{
			q: 'Can I use both local storage and Tigris?',
			a: 'Yes. Quotas are tracked per provider. Local keeps files on your deployment; Tigris stores objects in managed cloud buckets with S3-compatible APIs.'
		},
		{
			q: 'How does Pay as you go work?',
			a: 'After you outgrow included quotas, usage can be billed in arrears based on stored gigabytes and API operations. Final meters and rates depend on your region and contract.'
		},
		{
			q: 'Do you offer annual billing or non-profits?',
			a: 'Volume discounts, annual commits, and qualified non-profit pricing are available—use Get a quote and we will respond with options.'
		}
	] as const;
</script>

<svelte:head>
	<title>{appTitle('Pricing', ' | ')}</title>
	<meta
		name="description"
		content="{appName()} plans: Free, Starter, and Professional storage for local and Tigris. Pay as you go and enterprise quotes available."
	/>
</svelte:head>

<div
	class="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6 lg:gap-14 lg:px-8 lg:py-12"
>
	<header class="flex flex-col items-center text-center">
		<span
			class="mb-5 d-badge inline-flex h-auto min-h-0 items-center gap-2 d-badge-outline px-3 py-2 text-sm leading-normal font-medium"
		>
			<LucideSparkles class="size-4 shrink-0 opacity-80" aria-hidden="true" />
			Simple plans, clear limits
		</span>
		<h1 class="text-4xl font-bold tracking-tight text-base-content sm:text-5xl">Pricing</h1>
		<p class="mt-4 max-w-2xl text-base leading-relaxed text-base-content/80">
			Choose how much you keep on <strong class="font-semibold text-base-content">local disk</strong
			>
			vs
			<strong class="font-semibold text-base-content">Tigris</strong>. Everyone starts on Free;
			upgrade when you need more space.
		</p>
		<ul
			class="mt-6 grid max-w-xl gap-2 text-left text-sm text-base-content/75 sm:grid-cols-2 sm:gap-x-8"
		>
			<li class="flex gap-2 sm:col-span-2">
				<LucideCheck class="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
				<span>Free tier is automatic—no plan selected means Free (10 MB local, 1 GB Tigris).</span>
			</li>
			<li class="flex gap-2">
				<LucideCheck class="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
				<span>Same product features on every tier.</span>
			</li>
			<li class="flex gap-2">
				<LucideCheck class="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
				<span>Pay as you go and quotes for larger teams.</span>
			</li>
		</ul>
		<div class="mt-8 flex flex-wrap justify-center gap-3">
			<a class="d-btn d-btn-primary" href={signupHref}>Get started</a>
			<a class="d-btn d-btn-outline" href="#plans">View plans</a>
			<a class="d-btn d-btn-ghost" href="#compare">Compare table</a>
		</div>
	</header>

	<section aria-label="Plan highlights" class="grid gap-4 sm:grid-cols-3">
		<div class="d-card border border-base-300 bg-base-100 shadow-sm">
			<div class="d-card-body gap-3 p-5">
				<div class="flex items-center gap-2 text-primary">
					<LucideShieldCheck class="size-8 shrink-0" aria-hidden="true" />
					<span class="text-xs font-semibold tracking-wide uppercase opacity-80">Default</span>
				</div>
				<p class="text-xl font-bold">Free for everyone</p>
				<p class="text-sm leading-snug text-base-content/75">
					New accounts and users without a subscription stay on Free until you upgrade.
				</p>
			</div>
		</div>
		<div class="d-card border border-base-300 bg-base-100 shadow-sm">
			<div class="d-card-body gap-3 p-5">
				<div class="flex items-center gap-2 text-secondary">
					<LucideCloud class="size-8 shrink-0" aria-hidden="true" />
					<span class="text-xs font-semibold tracking-wide uppercase opacity-80">Providers</span>
				</div>
				<p class="text-xl font-bold">Local + Tigris</p>
				<p class="text-sm leading-snug text-base-content/75">
					Use on-server storage or S3-compatible cloud buckets—quotas are per provider.
				</p>
			</div>
		</div>
		<div class="d-card border border-base-300 bg-base-100 shadow-sm">
			<div class="d-card-body gap-3 p-5">
				<div class="flex items-center gap-2 text-accent">
					<LucideHeadphones class="size-8 shrink-0" aria-hidden="true" />
					<span class="text-xs font-semibold tracking-wide uppercase opacity-80">Support</span>
				</div>
				<p class="text-xl font-bold">Tiered by plan</p>
				<p class="text-sm leading-snug text-base-content/75">
					From community resources up to priority email on Professional and custom on quotes.
				</p>
			</div>
		</div>
	</section>

	<div role="alert" class="d-alert w-full border border-info/25 d-alert-info shadow-sm">
		<LucideShieldCheck class="size-6 shrink-0" aria-hidden="true" />
		<div class="text-left">
			<h2 class="text-base font-semibold">Free is the default for every user</h2>
			<p class="mt-1 text-sm opacity-90">
				No explicit plan means Free: 10 MB local and 1 GB Tigris until you change tier or contract.
			</p>
		</div>
	</div>

	<section id="plans" aria-labelledby="plans-heading" class="flex scroll-mt-20 flex-col gap-8">
		<div class="text-center">
			<h2 id="plans-heading" class="text-3xl font-bold text-base-content">
				Plans &amp; included storage
			</h2>
			<p class="mx-auto mt-2 max-w-2xl text-base-content/75">
				Prices below are indicative for self-serve tiers; your invoice may reflect taxes, currency,
				and deployment-specific adjustments.
			</p>
		</div>

		<div class="grid gap-6 lg:grid-cols-3">
			{#each corePlans as plan (plan.id)}
				<div
					class="d-card flex flex-col border border-base-300 bg-base-100 shadow-sm transition-shadow {plan.highlight
						? 'border-primary/40 ring-2 ring-primary/25'
						: ''}"
				>
					<div class="d-card-body flex flex-1 flex-col gap-4">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<h3 class="d-card-title text-xl">{plan.name}</h3>
							<span class="d-badge {plan.badgeVariant}">{plan.badge}</span>
						</div>
						<p class="text-sm text-base-content/75">{plan.tagline}</p>
						<div class="flex flex-wrap items-baseline gap-x-1 gap-y-0">
							<span class="text-4xl font-black tracking-tight">{plan.price}</span>
							<span class="text-sm text-base-content/60">
								{plan.id === 'free' ? plan.period : `· ${plan.period}`}
							</span>
						</div>
						<div class="rounded-box border border-base-300/80 bg-base-200/80 p-4 text-sm">
							<p class="mb-2 flex items-center gap-2 font-medium">
								<LucideHardDrive class="size-4 text-primary" />
								Local storage
							</p>
							<p class="text-lg font-semibold">{plan.local}</p>
							<div class="d-divider my-2"></div>
							<p class="mb-2 flex items-center gap-2 font-medium">
								<LucideCloud class="size-4 text-secondary" />
								Tigris cloud
							</p>
							<p class="text-lg font-semibold">{plan.tigris}</p>
						</div>
						<ul class="flex flex-1 flex-col gap-2 text-sm">
							{#each plan.features as line (line)}
								<li class="flex gap-2">
									<LucideCheck class="mt-0.5 size-4 shrink-0 text-success" />
									<span>{line}</span>
								</li>
							{/each}
						</ul>
						<div class="mt-2 d-card-actions">
							<a class="d-btn {plan.ctaVariant} w-full" href={signupHref}>{plan.cta}</a>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<section aria-labelledby="flex-heading" class="grid gap-6 lg:grid-cols-2">
		<div class="d-card border border-base-300 bg-base-100 shadow-sm">
			<div class="d-card-body gap-4">
				<div class="flex items-start gap-3">
					<div
						class="flex size-12 items-center justify-center rounded-box bg-accent/15 text-accent"
					>
						<LucideGauge class="size-7" />
					</div>
					<div>
						<h2 id="flex-heading" class="d-card-title">Pay as you go</h2>
						<p class="text-sm text-base-content/75">
							For workloads that spike or exceed bundle quotas, pay only for what you store and
							transfer. Metering aligns with your object storage provider and region.
						</p>
					</div>
				</div>
				<ul class="flex flex-col gap-2 text-sm">
					<li class="flex gap-2">
						<LucideCheck class="mt-0.5 size-4 shrink-0 text-success" />
						<span>No long-term commit—scale storage month to month.</span>
					</li>
					<li class="flex gap-2">
						<LucideCheck class="mt-0.5 size-4 shrink-0 text-success" />
						<span>Ideal when usage is unpredictable or project-based.</span>
					</li>
					<li class="flex gap-2">
						<LucideCheck class="mt-0.5 size-4 shrink-0 text-success" />
						<span>Combine with any plan when you need burst capacity.</span>
					</li>
				</ul>
				<div class="d-card-actions justify-start">
					<a class="d-btn d-btn-outline" href={signupHref}>Enable usage billing</a>
				</div>
			</div>
		</div>

		<div class="d-card border border-base-300 bg-base-100 shadow-sm">
			<div class="d-card-body gap-4">
				<div class="flex items-start gap-3">
					<div
						class="flex size-12 items-center justify-center rounded-box bg-secondary/15 text-secondary"
					>
						<LucideBuilding2 class="size-7" />
					</div>
					<div>
						<h2 class="d-card-title">Get a quote</h2>
						<p class="text-sm text-base-content/75">
							Need SSO, custom SLAs, dedicated support, or compliance documentation? We will scope
							storage, residency, and support to match your organization.
						</p>
					</div>
				</div>
				<ul class="flex flex-col gap-2 text-sm">
					<li class="flex gap-2">
						<LucideCheck class="mt-0.5 size-4 shrink-0 text-success" />
						<span>Volume pricing and annual agreements.</span>
					</li>
					<li class="flex gap-2">
						<LucideCheck class="mt-0.5 size-4 shrink-0 text-success" />
						<span>Private deployment and security review support.</span>
					</li>
					<li class="flex gap-2">
						<LucideCheck class="mt-0.5 size-4 shrink-0 text-success" />
						<span>Dedicated success check-ins for rollout.</span>
					</li>
				</ul>
				<div class="d-card-actions justify-start">
					<a class="d-btn d-btn-primary" href={quoteHref} target="_blank" rel="noopener noreferrer">
						Request a quote
					</a>
				</div>
			</div>
		</div>
	</section>

	<section id="compare" class="flex scroll-mt-20 flex-col gap-6" aria-labelledby="compare-heading">
		<div class="text-center">
			<h2 id="compare-heading" class="text-3xl font-bold text-base-content">Compare at a glance</h2>
			<p class="mx-auto mt-2 max-w-2xl text-base-content/75">
				All tiers include the same product surface area; differences are quotas and support levels.
			</p>
		</div>
		<div class="overflow-x-auto rounded-box border border-base-300 shadow-sm">
			<table class="d-table w-full min-w-[40rem] d-table-zebra">
				<thead>
					<tr>
						<th class="font-semibold">Capability</th>
						<th class="text-center font-semibold">Free</th>
						<th class="text-center font-semibold">Starter</th>
						<th class="text-center font-semibold">Professional</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Local storage quota</td>
						<td class="text-center">10 MB</td>
						<td class="text-center">10 MB</td>
						<td class="text-center">20 MB</td>
					</tr>
					<tr>
						<td>Tigris cloud quota</td>
						<td class="text-center">1 GB</td>
						<td class="text-center">5 GB</td>
						<td class="text-center">10 GB</td>
					</tr>
					<tr>
						<td>Default for new users</td>
						<td class="text-center">
							<span class="d-badge d-badge-sm d-badge-success">Yes</span>
						</td>
						<td class="text-center">—</td>
						<td class="text-center">—</td>
					</tr>
					<tr>
						<td>Support</td>
						<td class="text-center">Community</td>
						<td class="text-center">Email (business hours)</td>
						<td class="text-center">Priority email</td>
					</tr>
					<tr>
						<td>Billing</td>
						<td class="text-center">Included</td>
						<td class="text-center">Subscription</td>
						<td class="text-center">Subscription</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<section class="flex flex-col gap-4" aria-labelledby="faq-heading">
		<h2 id="faq-heading" class="text-center text-3xl font-bold text-base-content">
			Frequently asked questions
		</h2>
		<div class="mx-auto flex w-full max-w-3xl flex-col gap-2">
			{#each faq as item, i (item.q)}
				<div class="d-collapse-arrow d-collapse bg-base-200">
					<input type="radio" name="pricing-faq" checked={i === 0} />
					<div class="d-collapse-title font-medium">{item.q}</div>
					<div class="d-collapse-content text-sm text-base-content/80">
						<p>{item.a}</p>
					</div>
				</div>
			{/each}
		</div>
	</section>
</div>
