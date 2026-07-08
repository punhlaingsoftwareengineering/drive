import { getMainFileIfAccessible } from '$lib/server/drive-file-access';
import { db } from '$lib/server/db';
import { requireApiSession } from '$lib/server/require-api-session';
import {
	assertTeamKeyCanAccessFileRow,
	assertTeamKeyHas
} from '$lib/server/team-api-key-scope';
import { MainFileSchema, MainFileShareSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { error, json } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const bodySchema = z
	.object({
		targetEmail: z.string().email().max(320),
		permission: z.enum(['read', 'write']).optional().default('read'),
		canReshare: z.boolean().optional().default(false)
	})
	.strict();

export const POST: RequestHandler = async ({ request, params }) => {
	const session = await requireApiSession(request);
	assertTeamKeyHas(session, 'drive.share');

	const id = params.id;
	if (!id) throw error(400, 'Missing id');

	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}
	const parsed = bodySchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.message);

	const { targetEmail, permission, canReshare } = parsed.data;
	const emailNorm = targetEmail.trim().toLowerCase();

	const row = await getMainFileIfAccessible(session.user.id, id);
	if (!row || row.trashedAt) throw error(404, 'Not found');
	assertTeamKeyCanAccessFileRow(session, row);
	if (row.itemType !== 'file' && row.itemType !== 'folder') {
		throw error(400, 'Only files and folders can be shared');
	}

	const [existing] = await db
		.select({ id: MainFileShareSchema.id })
		.from(MainFileShareSchema)
		.where(and(eq(MainFileShareSchema.fileId, id), eq(MainFileShareSchema.targetEmail, emailNorm)))
		.limit(1);

	if (existing) {
		return json({ ok: true, alreadyShared: true });
	}

	await db.insert(MainFileShareSchema).values({
		fileId: id,
		ownerId: session.user.id,
		targetEmail: emailNorm,
		permission,
		canReshare
	});

	return json({ ok: true });
};
