<script lang="ts">
	import { Type } from '@lucide/svelte';
	import { applyFont } from '$lib/client/display-preferences';
	import { UI_FONT_OPTIONS } from '$lib/user-settings/ui-fonts';

	let dialog = $state<HTMLDialogElement | null>(null);
	let font = $state('roboto');

	const fontStacks: Record<string, string> = {
		'maple-mono': "'Maple Mono', ui-monospace, monospace",
		'adwaita-sans': "'Adwaita Sans', ui-sans-serif, system-ui, sans-serif",
		'adwaita-mono': "'Adwaita Mono', ui-monospace, monospace",
		roboto: "'Roboto', ui-sans-serif, system-ui, sans-serif",
		arial: 'Arial, Helvetica, sans-serif',
		'times-new-roman': "'Times New Roman', Times, serif",
		'comic-relief': "'ComicRelief', 'Comic Sans MS', cursive",
		pangolin: "'Pangolin', 'Comic Sans MS', cursive"
	};

	export function open() {
		font = document.documentElement.getAttribute('data-font') ?? 'roboto';
		dialog?.showModal();
	}

	function close() {
		dialog?.close();
	}

	function setFont(value: string) {
		font = value;
		applyFont(value);
		close();
	}
</script>

<dialog bind:this={dialog} class="d-modal">
	<div class="d-modal-box w-full max-w-2xl">
		<h3 class="flex items-center gap-2 text-lg font-bold">
			<Type class="size-5 text-primary" />
			Font
		</h3>
		<p class="mt-1 text-sm text-base-content/70">
			Choose a shared font for Drive, Docs, and Employee Portal on this browser.
		</p>

		<div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
			{#each UI_FONT_OPTIONS as option (option.value)}
				<button
					type="button"
					class="font-picker-option"
					class:font-picker-option--active={font === option.value}
					style:font-family={fontStacks[option.value]}
					onclick={() => setFont(option.value)}
				>
					<span class="font-picker-option__label">{option.label}</span>
					<span class="font-picker-option__sample"
						>The quick brown fox jumps over the lazy dog.</span
					>
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
	.font-picker-option {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		overflow: hidden;
		border-radius: var(--radius-box, 0.5rem);
		border: 2px solid color-mix(in oklab, var(--color-base-content) 15%, transparent);
		background: var(--color-base-100);
		padding: 0.75rem;
		text-align: left;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease,
			transform 0.15s ease;
	}

	.font-picker-option:hover {
		border-color: color-mix(in oklab, var(--color-primary) 45%, transparent);
		transform: translateY(-1px);
	}

	.font-picker-option--active {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-primary) 25%, transparent);
	}

	.font-picker-option__label {
		font-size: 0.875rem;
		font-weight: 600;
		line-height: 1.25;
	}

	.font-picker-option__sample {
		font-size: 0.8125rem;
		line-height: 1.4;
		opacity: 0.8;
	}
</style>
