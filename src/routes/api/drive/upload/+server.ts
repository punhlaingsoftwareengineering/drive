import { throwMappedUploadError } from '$lib/server/drive-upload-errors';
import { assertWithinUploadLimit } from '$lib/server/drive-upload-limits';
import { persistSealedUpload } from '$lib/server/drive-upload-persist';
import { parseSimpleUploadQuery, readUploadBody } from '$lib/server/drive-upload-query';
import { requireApiSession } from '$lib/server/require-api-session';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Binary upload (small files). Large files use `POST /api/drive/upload/chunk`.
 * Uses `application/octet-stream` so SvelteKit CSRF origin checks do not block LAN HTTP deploys.
 */
export const POST: RequestHandler = async ({ request, url }) => {
	const session = await requireApiSession(request);
	const userId = session.user.id;

	const meta = await parseSimpleUploadQuery(url, userId);
	const plain = await readUploadBody(request);

	assertWithinUploadLimit(plain.length);

	try {
		const row = await persistSealedUpload(
			userId,
			meta.storageProvider,
			meta.parentId,
			plain,
			meta.fileName,
			meta.mimeType,
			meta.teamId ? { teamId: meta.teamId } : undefined
		);
		return json({ ok: true, created: [row] });
	} catch (e) {
		throwMappedUploadError(e, {
			route: 'drive/upload',
			userId,
			storageProvider: meta.storageProvider,
			fileName: meta.fileName,
			bytes: plain.length,
			parentId: meta.parentId,
			teamId: meta.teamId
		});
	}
};
