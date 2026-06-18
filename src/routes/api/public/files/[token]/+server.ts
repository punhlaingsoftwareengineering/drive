import { buildFolderZipBuffer } from '$lib/server/drive-folder-zip';
import { readStoredBlob } from '$lib/server/drive-load';
import { openFileBuffer } from '$lib/server/drive-seal';
import { fileLooksLikeImage, guessImageMimeFromFileName } from '$lib/tool/image-kind';
import { effectiveContentType } from '$lib/tool/mime-kind';
import { db } from '$lib/server/db';
import {
	MainFilePublicLinkSchema,
	MainFileSchema
} from '$lib/server/db/schema/main-schema/main.schema';
import { error } from '@sveltejs/kit';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import type { RequestHandler } from './$types';

function contentDispositionInline(filename: string): string {
	const safe = filename.replace(/[\r\n"]/g, '_');
	const encoded = encodeURIComponent(filename);
	return `inline; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

function contentDispositionAttachment(filename: string): string {
	const safe = filename.replace(/[\r\n"]/g, '_');
	const encoded = encodeURIComponent(filename);
	return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

function zipAttachmentName(folderName: string): string {
	const base = folderName.replace(/[/\\]/g, '_').trim() || 'folder';
	return `${base}.zip`;
}

export const GET: RequestHandler = async ({ params }) => {
	const token = params.token;
	if (!token) throw error(400, 'Missing token');

	const [row] = await db
		.select({
			fileId: MainFileSchema.id,
			itemType: MainFileSchema.itemType,
			name: MainFileSchema.name,
			mimeType: MainFileSchema.mimeType,
			path: MainFileSchema.path,
			storageProvider: MainFileSchema.storageProvider,
			isTrashed: MainFileSchema.trashedAt,
			expiresAt: MainFilePublicLinkSchema.expiresAt
		})
		.from(MainFilePublicLinkSchema)
		.innerJoin(MainFileSchema, eq(MainFileSchema.id, MainFilePublicLinkSchema.fileId))
		.where(
			and(
				eq(MainFilePublicLinkSchema.token, token),
				isNull(MainFilePublicLinkSchema.revokedAt),
				or(
					isNull(MainFilePublicLinkSchema.expiresAt),
					gt(MainFilePublicLinkSchema.expiresAt, new Date())
				),
				isNull(MainFileSchema.trashedAt)
			)
		)
		.limit(1);

	if (!row || row.isTrashed) throw error(404, 'Not found');

	if (row.itemType === 'folder') {
		let buf: Buffer;
		try {
			buf = await buildFolderZipBuffer(row.fileId);
		} catch (e) {
			console.error('[public/files] folder zip failed', e);
			throw error(500, 'Failed to build archive');
		}
		const zipName = zipAttachmentName(row.name);
		return new Response(new Uint8Array(buf), {
			headers: {
				'Content-Type': 'application/zip',
				'Content-Disposition': contentDispositionAttachment(zipName),
				'Content-Length': String(buf.length),
				'Cache-Control': 'public, max-age=0, must-revalidate'
			}
		});
	}

	let stored: Buffer;
	try {
		stored = await readStoredBlob(row.path, row.storageProvider);
	} catch (e) {
		console.error('[public/files] read failed', e);
		throw error(502, 'Failed to read file');
	}

	let body: Buffer;
	try {
		body = openFileBuffer(stored);
	} catch (e) {
		console.error('[public/files] decrypt/decompress failed', e);
		throw error(500, 'Failed to decode file');
	}

	// Inline for images so the raw URL works in <img src="...">. Otherwise serve as attachment.
	const inline = fileLooksLikeImage(row.mimeType, row.name);
	let contentType = effectiveContentType(row.mimeType, row.name);
	if (inline && !contentType.startsWith('image/')) {
		const guessed = guessImageMimeFromFileName(row.name);
		if (guessed) contentType = guessed;
	}
	return new Response(new Uint8Array(body), {
		headers: {
			'Content-Type': contentType,
			'Content-Disposition': inline
				? contentDispositionInline(row.name)
				: contentDispositionAttachment(row.name),
			'Content-Length': String(body.length),
			'Cache-Control': 'public, max-age=0, must-revalidate'
		}
	});
};
