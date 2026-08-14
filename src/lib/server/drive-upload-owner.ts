import { getUsersByIds } from '$lib/server/auth-user-lookup';
import type { DriveApiSession } from '$lib/server/require-api-session';
import { error } from '@sveltejs/kit';

/** Portal/docs send this with a team API key so file `owner_id` is the real uploader. */
export const DRIVE_ON_BEHALF_OF_HEADER = 'x-drive-on-behalf-of';

/**
 * Who should own a newly uploaded file.
 * Cookie sessions always own as themselves.
 * API keys may set `X-Drive-On-Behalf-Of: <userId>` (shared auth user id).
 */
export async function resolveUploadOwnerUserId(
	session: DriveApiSession,
	request: Request
): Promise<string> {
	if (!session.viaApiKey) return session.user.id;

	const raw = request.headers.get(DRIVE_ON_BEHALF_OF_HEADER)?.trim() ?? '';
	if (!raw) return session.user.id;
	if (raw === session.user.id) return session.user.id;

	const users = await getUsersByIds([raw]);
	if (!users.has(raw)) {
		throw error(400, `Invalid ${DRIVE_ON_BEHALF_OF_HEADER}: user not found`);
	}
	return raw;
}
