import { z } from 'zod';

export const aiChatMessageSchema = z.object({
	role: z.enum(['user', 'assistant']),
	content: z.string().min(1).max(4000)
});

export const aiChatRequestSchema = z.object({
	message: z.string().min(1).max(2000),
	history: z.array(aiChatMessageSchema).max(20).default([])
});

export type AiChatMessage = z.infer<typeof aiChatMessageSchema>;
