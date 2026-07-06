import { assertParentFolderStorageProvider } from '$lib/server/drive-parent-provider';
import { resolveParentFolderForTeam } from '$lib/server/drive-parent-team';
import { resolveParentFolderForUser } from '$lib/server/drive-parent';
import { normalizeUploadMime } from '$lib/tool/mime-kind';
import {
	assertWithinUploadLimit,
	IN_MEMORY_SEAL_THRESHOLD_BYTES
} from '$lib/server/drive-upload-limits';
import {
	localPathNewFileAtRoot,
	localPathNewFileInsideFolder,
	tigrisKeyNewFileAtRoot,
	tigrisKeyNewFileAtRootTeam,
	tigrisKeyNewFileInsideFolder
} from '$lib/server/drive-storage-layout';
import { sealFileBuffer, sealFileStream } from '$lib/server/drive-seal';
import { nextSortOrderInParent } from '$lib/server/drive-sort-order';
import { db } from '$lib/server/db';
import { MainFileSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { localTeamUploadDir, localUserUploadDir } from '$lib/server/local-drive-path';
import { TigrisUtil } from '$lib/service/tigris.service.svelte';
import type { StorageProviderId } from '$lib/model/storage-provider';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';

export function safeUploadFileName(name: string): string {
	const normalized = name
		.normalize('NFKC')
		.replace(/[\0-\x1f\x7f]/g, '')
		.trim()
		.replace(/[/\\]/g, '_');
	const match = /^(.*?)(\.[^.]+)?$/.exec(normalized);
	const base = (match?.[1] ?? normalized).slice(0, 200);
	const ext = match?.[2] ?? '';
	const combined = base ? base + ext : ext || 'unnamed';
	return combined.slice(0, 220);
}

type PersistContext = {
	userId: string;
	provider: StorageProviderId;
	parentIdRaw: unknown;
	originalFileName: string;
	mimeType: string;
	teamId: string | null;
};

async function resolvePersistContext(ctx: PersistContext) {
	const name = safeUploadFileName(ctx.originalFileName);
	const mime = normalizeUploadMime(name, ctx.mimeType);

	if (ctx.teamId) {
		await assertParentFolderStorageProvider(ctx.provider, ctx.parentIdRaw, {
			kind: 'team',
			teamId: ctx.teamId,
			memberUserId: ctx.userId
		});
	} else {
		await assertParentFolderStorageProvider(ctx.provider, ctx.parentIdRaw, {
			kind: 'user',
			ownerId: ctx.userId
		});
	}

	const parentFolder = ctx.teamId
		? await resolveParentFolderForTeam(ctx.userId, ctx.teamId, ctx.provider, ctx.parentIdRaw)
		: await resolveParentFolderForUser(ctx.userId, ctx.provider, ctx.parentIdRaw);

	return { name, mime, parentFolder };
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
	assertWithinUploadLimit(plain.length);

	const teamId = opts?.teamId ?? null;
	const { name, mime, parentFolder } = await resolvePersistContext({
		userId,
		provider,
		parentIdRaw,
		originalFileName,
		mimeType,
		teamId
	});

	const sealed = sealFileBuffer(plain, { mime });
	const id = randomUUID();
	const sortOrder = await nextSortOrderInParent(
		parentFolder?.id ?? null,
		teamId
			? { kind: 'team', teamId, storageProvider: provider }
			: { kind: 'user', ownerId: userId, storageProvider: provider }
	);

	const baseInsert = {
		id,
		ownerId: userId,
		teamId,
		parentId: parentFolder?.id ?? null,
		itemType: 'file' as const,
		name,
		mimeType: mime,
		sizeBytes: BigInt(sealed.originalSize),
		isPinned: false,
		isStarred: false,
		trashedAt: null,
		isEncrypted: true,
		isCompressed: sealed.isCompressed,
		color: 'base' as const,
		sortOrder
	};

	if (provider === 'local') {
		const userDir = teamId ? localTeamUploadDir(teamId) : localUserUploadDir(userId);
		await mkdir(userDir, { recursive: true });
		const diskPath = parentFolder
			? localPathNewFileInsideFolder(parentFolder.path, id, name)
			: localPathNewFileAtRoot(userDir, id, name);
		await mkdir(parentFolder ? parentFolder.path : userDir, { recursive: true });
		await writeFile(diskPath, sealed.buffer);

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
		await TigrisUtil.upload(objectKey, sealed.buffer, {
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

/** Finalize a chunked upload from an on-disk assembled file (no full-file RAM buffer). */
export async function persistSealedUploadFromPath(
	userId: string,
	provider: StorageProviderId,
	parentIdRaw: unknown,
	sourcePath: string,
	originalFileName: string,
	mimeType: string,
	opts?: { teamId?: string | null }
): Promise<{ id: string; name: string }> {
	const fileStat = await stat(sourcePath);
	const originalSize = typeof fileStat.size === 'bigint' ? Number(fileStat.size) : fileStat.size;
	assertWithinUploadLimit(originalSize);

	const teamId = opts?.teamId ?? null;
	const { name, mime, parentFolder } = await resolvePersistContext({
		userId,
		provider,
		parentIdRaw,
		originalFileName,
		mimeType,
		teamId
	});

	const id = randomUUID();

	if (originalSize <= IN_MEMORY_SEAL_THRESHOLD_BYTES) {
		const plain = await readFile(sourcePath);
		return persistSealedUpload(
			userId,
			provider,
			parentIdRaw,
			plain,
			originalFileName,
			mimeType,
			opts
		);
	}

	const sortOrder = await nextSortOrderInParent(
		parentFolder?.id ?? null,
		teamId
			? { kind: 'team', teamId, storageProvider: provider }
			: { kind: 'user', ownerId: userId, storageProvider: provider }
	);

	const baseInsert = {
		id,
		ownerId: userId,
		teamId,
		parentId: parentFolder?.id ?? null,
		itemType: 'file' as const,
		name,
		mimeType: mime,
		sizeBytes: BigInt(originalSize),
		isPinned: false,
		isStarred: false,
		trashedAt: null,
		isEncrypted: true,
		isCompressed: false,
		color: 'base' as const,
		sortOrder
	};

	if (provider === 'local') {
		const userDir = teamId ? localTeamUploadDir(teamId) : localUserUploadDir(userId);
		await mkdir(userDir, { recursive: true });
		const diskPath = parentFolder
			? localPathNewFileInsideFolder(parentFolder.path, id, name)
			: localPathNewFileAtRoot(userDir, id, name);
		await mkdir(parentFolder ? parentFolder.path : userDir, { recursive: true });

		const sealed = await sealFileStream(sourcePath, diskPath, { mime, originalSize });
		baseInsert.isCompressed = sealed.isCompressed;

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

		const sealedTemp = join(tmpdir(), `znl-seal-${id}.bin`);
		try {
			const sealed = await sealFileStream(sourcePath, sealedTemp, { mime, originalSize });
			baseInsert.isCompressed = sealed.isCompressed;
			const sealedBuf = await readFile(sealedTemp);
			await TigrisUtil.upload(objectKey, sealedBuf, {
				contentType: 'application/octet-stream',
				multipart: originalSize > 32 * 1024 * 1024
			});
		} finally {
			await unlink(sealedTemp).catch(() => undefined);
		}

		await db.insert(MainFileSchema).values({
			...baseInsert,
			path: objectKey,
			storageProvider: 'tigris'
		});
	}

	return { id, name };
}
