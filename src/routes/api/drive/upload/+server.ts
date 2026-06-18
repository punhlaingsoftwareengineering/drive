import { throwMappedUploadError } from '$lib/server/drive-upload-errors';
import { persistSealedUpload } from '$lib/server/drive-upload-persist';
import { parseSimpleUploadQuery, readUploadBody } from '$lib/server/drive-upload-query';
import { requireApiSession } from '$lib/server/require-api-session';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAX_BYTES = 100 * 1024 * 1024;

/**
 * Binary upload (small files). Large files use `POST /api/drive/upload/chunk`.
 * Uses `application/octet-stream` so SvelteKit CSRF origin checks do not block LAN HTTP deploys.
 */
export const POST: RequestHandler = async ({ request, url }) => {
	const session = await requireApiSession(request);
	const userId = session.user.id;

	const meta = await parseSimpleUploadQuery(url, userId);
	const plain = await readUploadBody(request);

	if (plain.length > MAX_BYTES) {
		throw error(413, `File too large: ${meta.fileName}`);
	}

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
