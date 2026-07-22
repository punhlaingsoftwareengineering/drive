import type { AiChatMessage } from '$lib/schemas/ai-chat';

function normalize(text: string): string {
	return text.trim().toLowerCase();
}

function replyFor(message: string): string {
	const text = normalize(message);

	if (/upload|file|folder|create/.test(text)) {
		return 'Use the New or Upload actions in Drive to add files and folders. You can also drag and drop files into supported views.';
	}

	if (/share|shared|team|permission/.test(text)) {
		return 'Open Shared or your team workspace to review access. Sharing behavior depends on the current storage provider and workspace context.';
	}

	if (/trash|recent|search/.test(text)) {
		return 'Use Recent for your latest activity, Shared for incoming items, and Trash for deleted files. Search and filters depend on the current view.';
	}

	if (/theme|font|appearance|settings/.test(text)) {
		return 'Use the floating support button to change theme or font. Those appearance settings are shared across Drive, Docs, and Employee Portal on this browser.';
	}

	if (/hello|hi|hey|thanks|thank you/.test(text)) {
		return 'Hello! Ask me about uploads, sharing, navigation, or appearance settings.';
	}

	return 'I am not sure about that yet. Try asking about uploads, sharing, navigation, or appearance settings.';
}

export function generateAiAssistantReply(
	message: string,
	_history: AiChatMessage[] = []
): AiChatMessage {
	return {
		role: 'assistant',
		content: replyFor(message)
	};
}
