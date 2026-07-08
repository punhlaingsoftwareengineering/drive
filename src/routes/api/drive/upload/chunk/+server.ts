import {
	assembledPath,
	assembledSize,
	appendChunk,
	removeSession
} from '$lib/server/drive-upload-chunk-store';
import { throwMappedUploadError } from '$lib/server/drive-upload-errors';
import { assertWithinUploadLimit } from '$lib/server/drive-upload-limits';
import { assertDeveloperApiCanCreate } from '$lib/server/developer-api-limits';
import { assertTeamKeyHas } from '$lib/server/team-api-key-scope';
import { persistSealedUploadFromPath } from '$lib/server/drive-upload-persist';
import { parseChunkUploadQuery, readUploadBody } from '$lib/server/drive-upload-query';
import { requireApiSession } from '$lib/server/require-api-session';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url }) => {
	const session = await requireApiSession(request);
	assertTeamKeyHas(session, 'drive.write');
	const userId = session.user.id;

	const chunkIndex = Number(url.searchParams.get('chunkIndex'));
	const { chunkCount, uploadId, init } = await parseChunkUploadQuery(url, userId, chunkIndex, session);
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

		const size = await assembledSize(userId, sid);
		assertWithinUploadLimit(size);
		await assertDeveloperApiCanCreate(session, 'files');

		const teamId = meta.teamId ?? null;
		const created = await persistSealedUploadFromPath(
			userId,
			meta.storageProvider,
			meta.parentId,
			assembledPath(userId, sid),
			meta.fileName,
			meta.mimeType,
			{
				teamId,
				createdByApiKeyId: session.apiKeyId ?? null
			}
		);

		await removeSession(userId, sid);

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
