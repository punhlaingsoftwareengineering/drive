import { appendChunk, readAssembled, removeSession } from '$lib/server/drive-upload-chunk-store';
import { throwMappedUploadError } from '$lib/server/drive-upload-errors';
import { parseChunkUploadQuery, readUploadBody } from '$lib/server/drive-upload-query';
import { persistSealedUpload } from '$lib/server/drive-upload-persist';
import { requireApiSession } from '$lib/server/require-api-session';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAX_BYTES = 100 * 1024 * 1024;

export const POST: RequestHandler = async ({ request, url }) => {
	const session = await requireApiSession(request);
	const userId = session.user.id;

	const chunkIndex = Number(url.searchParams.get('chunkIndex'));
	const { chunkCount, uploadId, init } = await parseChunkUploadQuery(url, userId, chunkIndex);
	const buf = await readUploadBody(request);

	try {
		const { uploadId: sid, meta } = await appendChunk(
			userId,
			uploadId,
			chunkIndex,
			chunkCount,
			buf,
			init
		);

		if (meta.nextChunkIndex < meta.chunkCount) {
			return json({ uploadId: sid, done: false });
		}

		const plain = await readAssembled(userId, sid);
		await removeSession(userId, sid);

		if (plain.length > MAX_BYTES) {
			throw error(413, 'File too large');
		}

		const teamId = 'teamId' in meta && meta.teamId != null ? meta.teamId : null;
		const created = await persistSealedUpload(
			userId,
			meta.storageProvider,
			meta.parentId,
			plain,
			meta.fileName,
			meta.mimeType,
			teamId ? { teamId } : undefined
		);

		return json({ ok: true, done: true, uploadId: sid, created: [created] });
	} catch (e) {
		throwMappedUploadError(e, {
			route: 'drive/upload/chunk',
			userId,
			storageProvider: init?.storageProvider,
			fileName: init?.fileName,
			bytes: buf.length,
			parentId: init?.parentId,
			teamId: init?.teamId
		});
	}
};
