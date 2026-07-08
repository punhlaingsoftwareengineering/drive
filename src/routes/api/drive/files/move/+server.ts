import { moveDriveItemsForUser } from '$lib/server/drive-move';
import { requireApiSession } from '$lib/server/require-api-session';
import { isTeamMember } from '$lib/server/team-access';
import { assertTeamKeyHas, resolveEffectiveTeamIdParam } from '$lib/server/team-api-key-scope';
import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const bodySchema = z.object({
	ids: z.array(z.string().uuid()).min(1).max(100),
	parentId: z.string().uuid().nullable(),
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

	const { ids, parentId } = parsed.data;
	const storageProvider = parsed.data.storageProvider ?? 'local';
	const teamId = resolveEffectiveTeamIdParam(session, parsed.data.teamId);

	if (teamId && !(await isTeamMember(session.user.id, teamId))) {
		throw error(403, 'Forbidden');
	}

	const result = await moveDriveItemsForUser({
		userId: session.user.id,
		ids,
		parentId,
		teamId: teamId ?? null,
		storageProvider
	});

	return json(result);
};
