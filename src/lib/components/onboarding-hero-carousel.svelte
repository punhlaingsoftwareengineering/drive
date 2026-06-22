<script lang="ts">
	import { LucideChevronLeft, LucideChevronRight } from '@lucide/svelte';

	const slideModules = import.meta.glob('$lib/asset/image/*.{webp,png,jpg,jpeg}', {
		eager: true,
		import: 'default'
	}) as Record<string, string>;

	const slides = Object.entries(slideModules)
		.filter(([path]) => !path.endsWith('/README.md'))
		.map(([path, src]) => {
			const file = path.split('/').pop() ?? 'slide';
			const alt = file.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
			return { src, alt };
		});

	let active = $state(0);
	const count = $derived(slides.length);
	const current = $derived(slides[active]);

	function go(delta: number) {
		if (count < 2) return;
		active = (active + delta + count) % count;
	}
</script>

{#if count > 0}
	<div
		class="onboarding-hero-carousel mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8"
		aria-roledescription="carousel"
		aria-label="Product screenshots"
	>
		<div
			class="relative mx-auto flex w-full max-w-[min(100%,72rem)] items-center justify-center rounded-box border border-base-300/70 bg-base-200/35 p-4 sm:p-6"
		>
			<div
				class="flex w-full items-center justify-center"
				style="max-height: min(52vh, 28rem);"
			>
				{#if current}
					<img
						src={current.src}
						alt={current.alt}
						class="h-auto max-h-[min(52vh,28rem)] w-auto max-w-full object-contain"
						loading="lazy"
						decoding="async"
					/>
				{/if}
			</div>

			{#if count > 1}
				<button
					type="button"
					class="d-btn absolute top-1/2 left-2 z-10 -translate-y-1/2 d-btn-circle d-btn-sm d-btn-ghost bg-base-100/80 backdrop-blur"
					aria-label="Previous slide"
					onclick={() => go(-1)}
				>
					<LucideChevronLeft class="size-5" />
				</button>
				<button
					type="button"
					class="d-btn absolute top-1/2 right-2 z-10 -translate-y-1/2 d-btn-circle d-btn-sm d-btn-ghost bg-base-100/80 backdrop-blur"
					aria-label="Next slide"
					onclick={() => go(1)}
				>
					<LucideChevronRight class="size-5" />
				</button>

				<div class="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
					{#each slides as _, i (i)}
						<button
							type="button"
							class="size-2 rounded-full transition-colors {i === active
								? 'bg-primary'
								: 'bg-base-content/25 hover:bg-base-content/40'}"
							aria-label="Go to slide {i + 1}"
							aria-current={i === active ? 'true' : undefined}
							onclick={() => (active = i)}
						></button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
