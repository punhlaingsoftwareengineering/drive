import { resolveParentFolderForTeam } from '$lib/server/drive-parent-team';
import { resolveParentFolderForUser } from '$lib/server/drive-parent';
import { requireApiSession } from '$lib/server/require-api-session';
import { isTeamMember } from '$lib/server/team-access';
import {
	localPathNewFolderAtRoot,
	localPathNewSubfolder,
	tigrisKeyNewFolderAtRoot,
	tigrisKeyNewFolderAtRootTeam,
	tigrisKeyNewSubfolder,
	tigrisKeyNewSubfolderTeam
} from '$lib/server/drive-storage-layout';
import { db } from '$lib/server/db';
import { MainFileSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { nextSortOrderInParent } from '$lib/server/drive-sort-order';
import { localTeamUploadDir, localUserUploadDir } from '$lib/server/local-drive-path';
import { TigrisUtil } from '$lib/service/tigris.service.svelte';
import type { StorageProviderId } from '$lib/model/storage-provider';
import { error, json } from '@sveltejs/kit';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const bodySchema = z
	.object({
		name: z.string().min(1).max(500),
		storageProvider: z.enum(['local', 'tigris']),
		parentId: z.string().uuid().optional(),
		teamId: z.string().uuid().optional()
	})
	.strict();

function safeFolderName(name: string): string {
	const t = name.trim().replace(/[/\\]/g, '_');
	return t.slice(0, 500) || 'untitled';
}

export const POST: RequestHandler = async ({ request }) => {
	const session = await requireApiSession(request);

	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}
	const parsed = bodySchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.message);

	const provider = parsed.data.storageProvider as StorageProviderId;
	const name = safeFolderName(parsed.data.name);

	const userId = session.user.id;
	const teamId = parsed.data.teamId;
	if (teamId) {
		if (!(await isTeamMember(userId, teamId))) {
			throw error(403, 'Forbidden');
		}
	}
	const parentFolder = teamId
		? await resolveParentFolderForTeam(userId, teamId, provider, parsed.data.parentId)
		: await resolveParentFolderForUser(userId, provider, parsed.data.parentId);
	const id = randomUUID();
	const teamIdVal = teamId ?? null;
	const sortOrder = await nextSortOrderInParent(
		parentFolder?.id ?? null,
		teamId
			? { kind: 'team', teamId, storageProvider: provider }
			: { kind: 'user', ownerId: userId, storageProvider: provider }
	);

	if (provider === 'local') {
		const userDir = teamId ? localTeamUploadDir(teamId) : localUserUploadDir(userId);
		const diskPath = parentFolder
			? localPathNewSubfolder(parentFolder.path, id)
			: localPathNewFolderAtRoot(userDir, id);
		await mkdir(diskPath, { recursive: true });

		await db.insert(MainFileSchema).values({
			id,
			ownerId: userId,
			teamId: teamIdVal,
			parentId: parentFolder?.id ?? null,
			itemType: 'folder',
			path: diskPath,
			name,
			mimeType: 'inode/directory',
			sizeBytes: 0n,
			storageProvider: 'local',
			isPinned: false,
			isStarred: false,
			trashedAt: null,
			isEncrypted: false,
			isCompressed: false,
			color: null,
			sortOrder
		});
	} else {
		const objectKey = parentFolder
			? teamId
				? tigrisKeyNewSubfolderTeam(parentFolder.path, id)
				: tigrisKeyNewSubfolder(parentFolder.path, id)
			: teamId
				? tigrisKeyNewFolderAtRootTeam(teamId, id)
				: tigrisKeyNewFolderAtRoot(userId, id);
		try {
			await TigrisUtil.upload(objectKey, Buffer.alloc(0), {
				contentType: 'application/octet-stream'
			});
		} catch (e) {
			console.error('[drive/folders] Tigris upload failed', e);
			throw error(502, 'Tigris folder create failed. Check TIGRIS_* env vars and bucket access.');
		}

		await db.insert(MainFileSchema).values({
			id,
			ownerId: userId,
			teamId: teamIdVal,
			parentId: parentFolder?.id ?? null,
			itemType: 'folder',
			path: objectKey,
			name,
			mimeType: 'inode/directory',
			sizeBytes: 0n,
			storageProvider: 'tigris',
			isPinned: false,
			isStarred: false,
			trashedAt: null,
			isEncrypted: false,
			isCompressed: false,
			color: null,
			sortOrder
		});
	}

	return json({ ok: true, id, name });
};
