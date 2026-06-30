import { isTeamMember } from '$lib/server/team-access';
import { STORAGE_PROVIDERS, type StorageProviderId } from '$lib/model/storage-provider';
import { normalizeUploadMime } from '$lib/tool/mime-kind';
import { error } from '@sveltejs/kit';
import { z } from 'zod';

const uuid = z.string().uuid();

export type ChunkUploadInit = {
	fileName: string;
	mimeType: string;
	storageProvider: StorageProviderId;
	parentId: string | null;
	teamId: string | null;
};

function parseStorageProvider(raw: string | null): StorageProviderId {
	const sp = raw ?? 'local';
	if (!STORAGE_PROVIDERS.includes(sp as StorageProviderId)) {
		throw error(400, 'Invalid storage provider');
	}
	return sp as StorageProviderId;
}

function parseOptionalUuid(raw: string | null, label: string): string | null {
	if (!raw || raw.trim() === '') return null;
	const p = uuid.safeParse(raw.trim());
	if (!p.success) throw error(400, `Invalid ${label}`);
	return p.data;
}

async function parseOptionalTeamId(userId: string, raw: string | null): Promise<string | null> {
	const teamId = parseOptionalUuid(raw, 'team id');
	if (!teamId) return null;
	if (!(await isTeamMember(userId, teamId))) throw error(403, 'Forbidden');
	return teamId;
}

/** Read upload metadata from query string (binary body is `application/octet-stream`). */
export async function parseChunkUploadQuery(
	url: URL,
	userId: string,
	chunkIndex: number
): Promise<{
	chunkIndex: number;
	chunkCount: number;
	uploadId: string | null;
	init?: ChunkUploadInit;
}> {
	const chunkCount = Number(url.searchParams.get('chunkCount'));
	if (!Number.isInteger(chunkIndex) || !Number.isInteger(chunkCount) || chunkCount < 1) {
		throw error(400, 'Invalid chunk indices');
	}

	const uploadIdRaw = url.searchParams.get('uploadId');
	const uploadId =
		typeof uploadIdRaw === 'string' && uploadIdRaw.trim() !== '' ? uploadIdRaw.trim() : null;

	let init: ChunkUploadInit | undefined;
	if (chunkIndex === 0) {
		const parentId = parseOptionalUuid(url.searchParams.get('parentId'), 'parent folder');
		const teamId = await parseOptionalTeamId(userId, url.searchParams.get('teamId'));
		const fileName = url.searchParams.get('fileName')?.trim() || 'unnamed';
		init = {
			fileName,
			mimeType: normalizeUploadMime(fileName, url.searchParams.get('mimeType')),
			storageProvider: parseStorageProvider(url.searchParams.get('storageProvider')),
			parentId,
			teamId
		};
	}

	return { chunkIndex, chunkCount, uploadId, init };
}

export async function parseSimpleUploadQuery(
	url: URL,
	userId: string
): Promise<{
	storageProvider: StorageProviderId;
	parentId: string | null;
	teamId: string | null;
	fileName: string;
	mimeType: string;
}> {
	const fileName = url.searchParams.get('fileName')?.trim();
	if (!fileName) throw error(400, 'Missing fileName');

	const parentId = parseOptionalUuid(url.searchParams.get('parentId'), 'parent folder');
	const teamId = await parseOptionalTeamId(userId, url.searchParams.get('teamId'));

	return {
		storageProvider: parseStorageProvider(url.searchParams.get('storageProvider')),
		parentId,
		teamId,
		fileName,
		mimeType: normalizeUploadMime(fileName, url.searchParams.get('mimeType'))
	};
}

export async function readUploadBody(request: Request): Promise<Buffer> {
	const type = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? '';
	if (type !== 'application/octet-stream') {
		throw error(415, 'Expected Content-Type: application/octet-stream');
	}
	const buf = Buffer.from(await request.arrayBuffer());
	if (!buf.length) throw error(400, 'Empty upload body');
	return buf;
}
