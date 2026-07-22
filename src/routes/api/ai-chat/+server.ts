import { json, type RequestHandler } from '@sveltejs/kit';
import { aiChatRequestSchema } from '$lib/schemas/ai-chat';
import { generateAiAssistantReply } from '$lib/server/services/ai-assistant';

export const POST: RequestHandler = async (event) => {
	const body = await event.request.json();
	const { message, history } = aiChatRequestSchema.parse(body);
	return json(generateAiAssistantReply(message, history));
};
