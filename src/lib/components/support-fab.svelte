<script lang="ts">
	import { onMount } from 'svelte';
	import { BadgeQuestionMark, Bot, Palette, Type } from '@lucide/svelte';
	import AiChatDialog from '$lib/components/ai-chat-dialog.svelte';
	import ThemeDialog from '$lib/components/theme-dialog.svelte';
	import FontDialog from '$lib/components/font-dialog.svelte';

	let chatDialog = $state<AiChatDialog | null>(null);
	let themeDialog = $state<ThemeDialog | null>(null);
	let fontDialog = $state<FontDialog | null>(null);

	function closeFab() {
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
	}

	function openChat() {
		closeFab();
		chatDialog?.open();
	}

	function openTheme() {
		closeFab();
		themeDialog?.open();
	}

	function openFont() {
		closeFab();
		fontDialog?.open();
	}

	onMount(() => {
		function onKeydown(event: KeyboardEvent) {
			if (!event.ctrlKey || event.metaKey || event.altKey) return;
			if (event.key !== '/' && event.code !== 'Slash') return;

			const target = event.target;
			if (
				target instanceof HTMLElement &&
				(target.isContentEditable ||
					target.closest('input, textarea, select, [contenteditable="true"]') !== null)
			) {
				return;
			}

			event.preventDefault();
			closeFab();
			chatDialog?.open();
		}

		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});
</script>

<AiChatDialog bind:this={chatDialog} />
<ThemeDialog bind:this={themeDialog} />
<FontDialog bind:this={fontDialog} />

<div class="d-fab z-50">
	<div
		tabindex="0"
		role="button"
		class="d-btn d-btn-circle shadow-lg d-btn-primary"
		aria-label="Help"
	>
		<BadgeQuestionMark class="size-4" />
	</div>

	<div class="d-tooltip d-tooltip-left" data-tip="AI assistant (Ctrl+/)">
		<button
			type="button"
			class="d-btn d-btn-circle shadow-md d-btn-primary"
			aria-label="AI assistant (Ctrl+/)"
			onclick={openChat}
		>
			<Bot class="size-4" />
		</button>
	</div>

	<div class="d-tooltip d-tooltip-left" data-tip="Font">
		<button
			type="button"
			class="d-btn d-btn-circle shadow-md d-btn-warning"
			aria-label="Font"
			onclick={openFont}
		>
			<Type class="size-4" />
		</button>
	</div>

	<div class="d-tooltip d-tooltip-left" data-tip="Theme">
		<button
			type="button"
			class="d-btn d-btn-circle shadow-md d-btn-info"
			aria-label="Theme"
			onclick={openTheme}
		>
			<Palette class="size-4" />
		</button>
	</div>
</div>
