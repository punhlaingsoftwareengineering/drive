<script lang="ts">
	import { Bot, Send } from '@lucide/svelte';
	import {
		AI_ASSISTANT_SUGGESTED_PROMPTS,
		AI_ASSISTANT_WELCOME_MESSAGE
	} from '$lib/constants/ai-assistant';
	import type { AiChatMessage } from '$lib/schemas/ai-chat';

	let dialog = $state<HTMLDialogElement | null>(null);
	let messages = $state<AiChatMessage[]>([
		{ role: 'assistant', content: AI_ASSISTANT_WELCOME_MESSAGE }
	]);
	let draft = $state('');
	let sending = $state(false);
	let error = $state<string | null>(null);
	let messagesEnd = $state<HTMLDivElement | null>(null);

	export function open() {
		error = null;
		dialog?.showModal();
		queueMicrotask(() => messagesEnd?.scrollIntoView({ behavior: 'smooth' }));
	}

	function close() {
		dialog?.close();
	}

	function useSuggestion(prompt: string) {
		draft = prompt;
	}

	async function sendMessage(event: SubmitEvent | undefined = undefined) {
		event?.preventDefault();
		const text = draft.trim();
		if (!text || sending) return;

		const userMessage: AiChatMessage = { role: 'user', content: text };
		messages = [...messages, userMessage];
		draft = '';
		sending = true;
		error = null;

		try {
			const response = await fetch('/api/ai-chat', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ message: text, history: messages })
			});

			if (!response.ok) throw new Error('Failed to get a reply');
			const reply = (await response.json()) as AiChatMessage;
			messages = [...messages, reply];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to send message';
		} finally {
			sending = false;
			queueMicrotask(() => messagesEnd?.scrollIntoView({ behavior: 'smooth' }));
		}
	}
</script>

<dialog bind:this={dialog} class="d-modal">
	<div class="d-modal-box flex max-h-[90vh] w-full max-w-lg flex-col p-0">
		<div class="border-b border-base-300 px-6 py-4">
			<h3 class="flex items-center gap-2 text-lg font-bold">
				<Bot class="size-5 text-secondary" />
				AI assistant
			</h3>
			<p class="mt-1 text-sm text-base-content/70">
				Quick answers about Drive navigation and sharing.
			</p>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
			<div class="flex flex-col gap-3">
				{#each messages as message, index (index)}
					<div class="chat {message.role === 'user' ? 'chat-end' : 'chat-start'}">
						<div
							class="chat-bubble {message.role === 'user'
								? 'chat-bubble-primary'
								: 'chat-bubble-base-200'}"
						>
							{message.content}
						</div>
					</div>
				{/each}
				<div bind:this={messagesEnd}></div>
			</div>

			{#if messages.length === 1}
				<div class="mt-4 flex flex-wrap gap-2">
					{#each AI_ASSISTANT_SUGGESTED_PROMPTS as prompt (prompt)}
						<button
							type="button"
							class="d-btn d-btn-outline d-btn-xs"
							onclick={() => useSuggestion(prompt)}
						>
							{prompt}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		{#if error}
			<div class="px-4 pb-2">
				<div class="d-alert py-2 d-alert-error">
					<span class="text-sm">{error}</span>
				</div>
			</div>
		{/if}

		<form class="border-t border-base-300 p-4" onsubmit={sendMessage}>
			<div class="flex gap-2">
				<input
					class="d-input-bordered d-input min-w-0 flex-1"
					placeholder="Ask a question..."
					bind:value={draft}
					disabled={sending}
					maxlength={2000}
				/>
				<button
					type="submit"
					class="d-btn d-btn-square d-btn-primary"
					aria-label="Send message"
					disabled={sending || !draft.trim()}
				>
					<Send class="size-4" />
				</button>
			</div>
		</form>

		<div class="d-modal-action mt-0 border-t border-base-300 px-4 py-3">
			<button type="button" class="d-btn d-btn-ghost d-btn-sm" onclick={close}>Close</button>
		</div>
	</div>
	<form method="dialog" class="d-modal-backdrop">
		<button aria-label="Close dialog">close</button>
	</form>
</dialog>
