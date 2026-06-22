import { db } from '$lib/server/db';
import { sizeBytesJson } from '$lib/server/drive-size-json';
import {
	MainFilePublicLinkSchema,
	MainFileSchema
} from '$lib/server/db/schema/main-schema/main.schema';
import { error, json } from '@sveltejs/kit';
import { and, eq, isNull, or, gt } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const token = params.token;
	if (!token) throw error(400, 'Missing token');

	const [row] = await db
		.select({
			token: MainFilePublicLinkSchema.token,
			revokedAt: MainFilePublicLinkSchema.revokedAt,
			expiresAt: MainFilePublicLinkSchema.expiresAt,
			fileId: MainFileSchema.id,
			ownerId: MainFileSchema.ownerId,
			itemType: MainFileSchema.itemType,
			name: MainFileSchema.name,
			mimeType: MainFileSchema.mimeType,
			sizeBytes: MainFileSchema.sizeBytes,
			updatedAt: MainFileSchema.updatedAt,
			storageProvider: MainFileSchema.storageProvider
		})
		.from(MainFilePublicLinkSchema)
		.innerJoin(MainFileSchema, eq(MainFileSchema.id, MainFilePublicLinkSchema.fileId))
		.where(
			and(
				eq(MainFilePublicLinkSchema.token, token),
				isNull(MainFilePublicLinkSchema.revokedAt),
				or(
					isNull(MainFilePublicLinkSchema.expiresAt),
					gt(MainFilePublicLinkSchema.expiresAt, new Date())
				),
				isNull(MainFileSchema.trashedAt)
			)
		)
		.limit(1);

	if (!row) throw error(404, 'Not found');

	return json({
		ok: true,
		token,
		item: {
			id: row.fileId,
			ownerId: row.ownerId,
			itemType: row.itemType,
			name: row.name,
			mimeType: row.mimeType,
			sizeBytes: sizeBytesJson(row.sizeBytes),
			updatedAt: row.updatedAt.toISOString(),
			storageProvider: row.storageProvider
		}
	});
};
