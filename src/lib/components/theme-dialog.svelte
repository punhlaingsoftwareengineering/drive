<script lang="ts">
	import { Palette } from '@lucide/svelte';
	import { applyTheme } from '$lib/client/display-preferences';
	import { DAISYUI_THEMES } from '$lib/user-settings/daisy-themes';

	let dialog = $state<HTMLDialogElement | null>(null);
	let theme = $state('light');

	const stripeColors = [
		'bg-primary',
		'bg-secondary',
		'bg-accent',
		'bg-neutral',
		'bg-info'
	] as const;

	export function open() {
		theme = document.documentElement.getAttribute('data-theme') ?? 'light';
		dialog?.showModal();
	}

	function close() {
		dialog?.close();
	}

	function setTheme(value: string) {
		theme = value;
		applyTheme(value);
		close();
	}

	function formatLabel(value: string) {
		return value
			.split('-')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}
</script>

<dialog bind:this={dialog} class="d-modal">
	<div class="d-modal-box w-full max-w-4xl">
		<h3 class="flex items-center gap-2 text-lg font-bold">
			<Palette class="size-5 text-primary" />
			Theme
		</h3>
		<p class="mt-1 text-sm text-base-content/70">
			Choose a shared theme for Drive, Docs, and Employee Portal on this browser.
		</p>

		<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each DAISYUI_THEMES as option (option)}
				<button
					type="button"
					class="theme-picker-option"
					class:theme-picker-option--active={theme === option}
					onclick={() => setTheme(option)}
				>
					<div data-theme={option} class="theme-picker-stripe" aria-hidden="true">
						{#each stripeColors as colorClass (colorClass)}
							<span class={colorClass}></span>
						{/each}
					</div>

					<span data-theme={option} class="theme-picker-option__label">
						{formatLabel(option)}
					</span>
				</button>
			{/each}
		</div>

		<div class="d-modal-action">
			<button type="button" class="d-btn d-btn-ghost d-btn-sm" onclick={close}>Close</button>
		</div>
	</div>
	<form method="dialog" class="d-modal-backdrop">
		<button aria-label="Close dialog">close</button>
	</form>
</dialog>

<style>
	.theme-picker-option {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: var(--radius-box, 0.5rem);
		border: 2px solid color-mix(in oklab, var(--color-base-content) 15%, transparent);
		background: transparent;
		padding: 0;
		text-align: center;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease,
			transform 0.15s ease;
	}

	.theme-picker-option:hover {
		border-color: color-mix(in oklab, var(--color-primary) 45%, transparent);
		transform: translateY(-1px);
	}

	.theme-picker-option--active {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-primary) 25%, transparent);
	}

	.theme-picker-stripe {
		display: flex;
		height: 0.625rem;
		width: 100%;
	}

	.theme-picker-stripe > span {
		flex: 1;
		min-width: 0;
	}

	.theme-picker-option__label {
		display: block;
		background: var(--color-base-100);
		color: var(--color-base-content);
		padding: 0.625rem 0.5rem;
		font-size: 0.8125rem;
		font-weight: 600;
		line-height: 1.25;
	}
</style>
