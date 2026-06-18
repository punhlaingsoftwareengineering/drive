import { assertParentFolderStorageProvider } from '$lib/server/drive-parent-provider';
import { resolveParentFolderForTeam } from '$lib/server/drive-parent-team';
import { resolveParentFolderForUser } from '$lib/server/drive-parent';
import { normalizeUploadMime } from '$lib/tool/mime-kind';
import {
	localPathNewFileAtRoot,
	localPathNewFileInsideFolder,
	tigrisKeyNewFileAtRoot,
	tigrisKeyNewFileAtRootTeam,
	tigrisKeyNewFileInsideFolder
} from '$lib/server/drive-storage-layout';
import { sealFileBuffer } from '$lib/server/drive-seal';
import { db } from '$lib/server/db';
import { MainFileSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { localTeamUploadDir, localUserUploadDir } from '$lib/server/local-drive-path';
import { TigrisUtil } from '$lib/service/tigris.service.svelte';
import type { StorageProviderId } from '$lib/model/storage-provider';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const MAX_BYTES = 100 * 1024 * 1024;

export function safeUploadFileName(name: string): string {
	const normalized = name
		.normalize('NFKC')
		.replace(/[\0-\x1f\x7f]/g, '')
		.trim()
		.replace(/[/\\]/g, '_');
	const match = /^(.*?)(\.[^.]+)?$/.exec(normalized);
	const base = (match?.[1] ?? normalized).slice(0, 200) || 'unnamed';
	const ext = match?.[2] ?? '';
	return (base + ext).slice(0, 220);
}

export async function persistSealedUpload(
	userId: string,
	provider: StorageProviderId,
	parentIdRaw: unknown,
	plain: Buffer,
	originalFileName: string,
	mimeType: string,
	opts?: { teamId?: string | null }
): Promise<{ id: string; name: string }> {
	if (plain.length > MAX_BYTES) {
		throw new Error(`File too large (max ${MAX_BYTES} bytes)`);
	}

	const sealed = sealFileBuffer(plain);
	const teamId = opts?.teamId ?? null;
	const name = safeUploadFileName(originalFileName);
	const mime = normalizeUploadMime(name, mimeType);

	if (teamId) {
		await assertParentFolderStorageProvider(provider, parentIdRaw, {
			kind: 'team',
			teamId,
			memberUserId: userId
		});
	} else {
		await assertParentFolderStorageProvider(provider, parentIdRaw, {
			kind: 'user',
			ownerId: userId
		});
	}

	const parentFolder = teamId
		? await resolveParentFolderForTeam(userId, teamId, provider, parentIdRaw)
		: await resolveParentFolderForUser(userId, provider, parentIdRaw);
	const id = randomUUID();
	const stored = sealed.buffer;

	const baseInsert = {
		id,
		ownerId: userId,
		teamId,
		parentId: parentFolder?.id ?? null,
		itemType: 'file' as const,
		name,
		mimeType: mime,
		sizeBytes: sealed.originalSize,
		isPinned: false,
		isStarred: false,
		trashedAt: null,
		isEncrypted: true,
		isCompressed: true,
		color: 'base' as const
	};

	if (provider === 'local') {
		const userDir = teamId ? localTeamUploadDir(teamId) : localUserUploadDir(userId);
		await mkdir(userDir, { recursive: true });
		const diskPath = parentFolder
			? localPathNewFileInsideFolder(parentFolder.path, id, name)
			: localPathNewFileAtRoot(userDir, id, name);
		await mkdir(parentFolder ? parentFolder.path : userDir, { recursive: true });
		await writeFile(diskPath, stored);

		await db.insert(MainFileSchema).values({
			...baseInsert,
			path: diskPath,
			storageProvider: 'local'
		});
	} else {
		const objectKey = parentFolder
			? tigrisKeyNewFileInsideFolder(parentFolder.path, id, name)
			: teamId
				? tigrisKeyNewFileAtRootTeam(teamId, id, name)
				: tigrisKeyNewFileAtRoot(userId, id, name);
		await TigrisUtil.upload(objectKey, stored, {
			contentType: 'application/octet-stream'
		});

		await db.insert(MainFileSchema).values({
			...baseInsert,
			path: objectKey,
			storageProvider: 'tigris'
		});
	}

	return { id, name };
}
