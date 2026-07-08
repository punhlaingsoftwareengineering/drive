import { requireMainFileForMutation } from '$lib/server/drive-file-access';
import { requireApiSession } from '$lib/server/require-api-session';
import {
	assertTeamKeyCanAccessFileRow,
	assertTeamKeyHas
} from '$lib/server/team-api-key-scope';
import { db } from '$lib/server/db';
import { MainFileSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { FILE_LABEL_COLORS, type FileLabelColorId } from '$lib/model/file-label-color';

const colorEnum = z.enum(FILE_LABEL_COLORS as unknown as [FileLabelColorId, ...FileLabelColorId[]]);
import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const patchSchema = z
	.object({
		isPinned: z.boolean().optional(),
		isStarred: z.boolean().optional(),
		color: z.union([colorEnum, z.null()]).optional(),
		trashed: z.boolean().optional()
	})
	.strict();

const bodySchema = z
	.object({
		ids: z.array(z.string().uuid()).min(1).max(200),
		patch: patchSchema
	})
	.strict();

export const POST: RequestHandler = async ({ request }) => {
	const session = await requireApiSession(request);

	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const parsed = bodySchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.message);

	const { ids, patch } = parsed.data;
	if (Object.keys(patch).length === 0) {
		throw error(400, 'No fields to update');
	}

	if (patch.trashed !== undefined) {
		assertTeamKeyHas(session, 'drive.delete');
	}
	if (
		patch.isPinned !== undefined ||
		patch.isStarred !== undefined ||
		patch.color !== undefined
	) {
		assertTeamKeyHas(session, 'drive.write');
	}

	const failed: { id: string; reason: string }[] = [];
	let successCount = 0;

	for (const id of ids) {
		try {
			const row = await requireMainFileForMutation(session.user.id, id);
			assertTeamKeyCanAccessFileRow(session, row);
			const updates: Partial<typeof MainFileSchema.$inferInsert> = {};

			if (patch.isPinned !== undefined) updates.isPinned = patch.isPinned;
			if (patch.isStarred !== undefined) updates.isStarred = patch.isStarred;
			if (patch.color !== undefined) updates.color = patch.color;
			if (patch.trashed !== undefined) {
				updates.trashedAt = patch.trashed ? new Date() : null;
			}

			if (Object.keys(updates).length === 0) {
				failed.push({ id, reason: 'No applicable fields' });
				continue;
			}

			if (row.trashedAt && patch.trashed !== false) {
				failed.push({ id, reason: 'Item is in trash' });
				continue;
			}

			await db.update(MainFileSchema).set(updates).where(eq(MainFileSchema.id, id));
			successCount++;
		} catch (e) {
			failed.push({
				id,
				reason: e instanceof Error ? e.message : 'Update failed'
			});
		}
	}

	return json({ ok: failed.length === 0, failed, updated: successCount });
};
