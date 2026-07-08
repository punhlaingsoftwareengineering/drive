import { throwMappedUploadError } from '$lib/server/drive-upload-errors';
import { assertWithinUploadLimit } from '$lib/server/drive-upload-limits';
import { assertDeveloperApiCanCreate } from '$lib/server/developer-api-limits';
import { assertTeamKeyHas } from '$lib/server/team-api-key-scope';
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
	assertTeamKeyHas(session, 'drive.write');
	const userId = session.user.id;

	const meta = await parseSimpleUploadQuery(url, userId, session);
	const plain = await readUploadBody(request);

	assertWithinUploadLimit(plain.length);
	await assertDeveloperApiCanCreate(session, 'files');

	try {
		const row = await persistSealedUpload(
			userId,
			meta.storageProvider,
			meta.parentId,
			plain,
			meta.fileName,
			meta.mimeType,
			{
				teamId: meta.teamId ?? null,
				createdByApiKeyId: session.apiKeyId ?? null
			}
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
