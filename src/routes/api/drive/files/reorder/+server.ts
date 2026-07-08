import { requireApiSession } from '$lib/server/require-api-session';
import {
	assertTeamKeyCanAccessFileRow,
	assertTeamKeyHas,
	resolveEffectiveTeamIdParam
} from '$lib/server/team-api-key-scope';
import { db } from '$lib/server/db';
import { MainFileSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { TeamSchema } from '$lib/server/db/schema/main-schema/team.schema';
import { isTeamMember } from '$lib/server/team-access';
import { STORAGE_PROVIDERS, type StorageProviderId } from '$lib/model/storage-provider';
import { error, json } from '@sveltejs/kit';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const bodySchema = z.object({
	orderedIds: z.array(z.string().uuid()).min(1),
	parentId: z.string().uuid().nullable().optional(),
	teamId: z.string().uuid().optional(),
	storageProvider: z.enum(['local', 'tigris']).optional()
});

export const POST: RequestHandler = async ({ request }) => {
	const session = await requireApiSession(request);
	assertTeamKeyHas(session, 'drive.write');

	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const parsed = bodySchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.message);

	const { orderedIds } = parsed.data;
	const storageProvider = parsed.data.storageProvider ?? 'local';
	const teamId = resolveEffectiveTeamIdParam(session, parsed.data.teamId);
	let parentId: string | null = parsed.data.parentId ?? null;

	if (teamId) {
		if (!(await isTeamMember(session.user.id, teamId))) {
			throw error(403, 'Forbidden');
		}
		if (!parentId) {
			const [t] = await db
				.select({ root: TeamSchema.rootFolderId })
				.from(TeamSchema)
				.where(eq(TeamSchema.id, teamId))
				.limit(1);
			parentId = t?.root ?? null;
		}
	}

	const rows = await db
		.select({
			id: MainFileSchema.id,
			parentId: MainFileSchema.parentId,
			ownerId: MainFileSchema.ownerId,
			teamId: MainFileSchema.teamId,
			storageProvider: MainFileSchema.storageProvider
		})
		.from(MainFileSchema)
		.where(and(inArray(MainFileSchema.id, orderedIds), isNull(MainFileSchema.trashedAt)));

	if (rows.length !== orderedIds.length) {
		throw error(400, 'One or more items not found');
	}

	const expectedParent = parentId;
	for (const row of rows) {
		const rowParent = row.parentId ?? null;
		if (rowParent !== expectedParent) {
			throw error(400, 'Items must share the same parent folder');
		}
		if (teamId) {
			if (row.teamId !== teamId || row.storageProvider !== storageProvider) {
				throw error(403, 'Forbidden');
			}
		} else if (row.ownerId !== session.user.id || row.teamId !== null) {
			throw error(403, 'Forbidden');
		} else if (row.storageProvider !== storageProvider) {
			throw error(400, 'Storage provider mismatch');
		}
		assertTeamKeyCanAccessFileRow(session, row);
	}

	const idSet = new Set(orderedIds);
	if (idSet.size !== orderedIds.length) {
		throw error(400, 'Duplicate ids in orderedIds');
	}

	for (let i = 0; i < orderedIds.length; i++) {
		await db
			.update(MainFileSchema)
			.set({ sortOrder: i })
			.where(eq(MainFileSchema.id, orderedIds[i]));
	}

	return json({ ok: true });
};
