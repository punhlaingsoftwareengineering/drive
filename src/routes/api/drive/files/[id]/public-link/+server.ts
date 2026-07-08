import { getMainFileIfAccessible, requireMainFileForMutation } from '$lib/server/drive-file-access';
import { requireApiSession } from '$lib/server/require-api-session';
import {
	assertTeamKeyCanAccessFileRow,
	assertTeamKeyHas
} from '$lib/server/team-api-key-scope';
import { appAbsoluteUrlFromRequest } from '$lib/server/app-absolute-url';
import { db } from '$lib/server/db';
import {
	MainFilePublicLinkSchema,
	MainFileSchema
} from '$lib/server/db/schema/main-schema/main.schema';
import { error, json } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { RequestHandler } from './$types';

function newToken(): string {
	// ~12 chars URL-safe (example: o3891y8qhw9)
	return randomBytes(9).toString('base64url');
}

export const GET: RequestHandler = async ({ request, params }) => {
	const session = await requireApiSession(request);
	assertTeamKeyHas(session, 'drive.read');
	const id = params.id;
	if (!id) throw error(400, 'Missing id');

	const file = await getMainFileIfAccessible(session.user.id, id);
	if (!file) {
		throw error(404, 'Not found');
	}
	assertTeamKeyCanAccessFileRow(session, file);

	const [publicLink] = await db
		.select({
			token: MainFilePublicLinkSchema.token,
			mimeType: MainFileSchema.mimeType,
			itemType: MainFileSchema.itemType,
			name: MainFileSchema.name
		})
		.from(MainFilePublicLinkSchema)
		.innerJoin(MainFileSchema, eq(MainFileSchema.id, MainFilePublicLinkSchema.fileId))
		.where(
			and(
				eq(MainFilePublicLinkSchema.fileId, id),
				isNull(MainFilePublicLinkSchema.revokedAt),
				isNull(MainFileSchema.trashedAt)
			)
		)
		.limit(1);

	if (!publicLink) {
		return json({ public: false as const });
	}

	const shareUrl = appAbsoluteUrlFromRequest(request.url, `/${publicLink.token}`);
	const fileDirectUrl =
		publicLink.itemType === 'file'
			? appAbsoluteUrlFromRequest(request.url, `/api/public/files/${publicLink.token}`)
			: undefined;

	return json({
		public: true as const,
		token: publicLink.token,
		shareUrl,
		fileDirectUrl
	});
};

export const POST: RequestHandler = async ({ request, params }) => {
	const session = await requireApiSession(request);
	assertTeamKeyHas(session, 'drive.share');
	const id = params.id;
	if (!id) throw error(400, 'Missing id');

	const item = await requireMainFileForMutation(session.user.id, id);
	assertTeamKeyCanAccessFileRow(session, item);

	const [existing] = await db
		.select({
			token: MainFilePublicLinkSchema.token
		})
		.from(MainFilePublicLinkSchema)
		.where(
			and(
				eq(MainFilePublicLinkSchema.fileId, id),
				eq(MainFilePublicLinkSchema.ownerId, session.user.id),
				isNull(MainFilePublicLinkSchema.revokedAt)
			)
		)
		.limit(1);

	const token = existing?.token ?? newToken();
	if (!existing) {
		await db.insert(MainFilePublicLinkSchema).values({
			fileId: id,
			ownerId: session.user.id,
			token
		});
	}

	const shareUrl = appAbsoluteUrlFromRequest(request.url, `/${token}`);
	const fileDirectUrl =
		item.itemType === 'file'
			? appAbsoluteUrlFromRequest(request.url, `/api/public/files/${token}`)
			: null;

	return json({
		ok: true,
		token,
		shareUrl,
		fileDirectUrl
	});
};

export const DELETE: RequestHandler = async ({ request, params }) => {
	const session = await requireApiSession(request);
	assertTeamKeyHas(session, 'drive.share');
	const id = params.id;
	if (!id) throw error(400, 'Missing id');

	const item = await requireMainFileForMutation(session.user.id, id);
	assertTeamKeyCanAccessFileRow(session, item);

	await db
		.update(MainFilePublicLinkSchema)
		.set({ revokedAt: new Date() })
		.where(
			and(
				eq(MainFilePublicLinkSchema.fileId, id),
				eq(MainFilePublicLinkSchema.ownerId, session.user.id),
				isNull(MainFilePublicLinkSchema.revokedAt)
			)
		);

	return json({ ok: true });
};
