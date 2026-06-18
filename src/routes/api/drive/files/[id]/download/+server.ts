import { buildFolderZipBuffer } from '$lib/server/drive-folder-zip';
import { userCanAccessFile } from '$lib/server/team-access';
import { openFileBuffer } from '$lib/server/drive-seal';
import { requireApiSession } from '$lib/server/require-api-session';
import { readStoredBlob } from '$lib/server/drive-load';
import { canAccessSharedItem, sharedRootIdsForRecipient } from '$lib/server/drive-shared-access';
import { db } from '$lib/server/db';
import { MainFileSchema, MainFileShareSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { effectiveContentType } from '$lib/tool/mime-kind';
import { error } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';

function contentDisposition(filename: string): string {
	const safe = filename.replace(/[\r\n"]/g, '_');
	const encoded = encodeURIComponent(filename);
	return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

function zipAttachmentName(folderName: string): string {
	const base = folderName.replace(/[/\\]/g, '_').trim() || 'folder';
	return `${base}.zip`;
}

export const GET: RequestHandler = async ({ request, params }) => {
	const session = await requireApiSession(request);

	const id = params.id;
	if (!id) throw error(400, 'Missing id');

	const [row] = await db
		.select()
		.from(MainFileSchema)
		.where(and(eq(MainFileSchema.id, id), isNull(MainFileSchema.trashedAt)))
		.limit(1);

	if (!row) throw error(404, 'Not found');

	let allowed = await userCanAccessFile(session.user.id, {
		ownerId: row.ownerId,
		teamId: row.teamId
	});

	if (!allowed && session.user.email) {
		const email = session.user.email.toLowerCase();
		const [share] = await db
			.select({ id: MainFileShareSchema.id })
			.from(MainFileShareSchema)
			.where(and(eq(MainFileShareSchema.fileId, id), eq(MainFileShareSchema.targetEmail, email)))
			.limit(1);
		if (share) {
			allowed = true;
		} else {
			const roots = await sharedRootIdsForRecipient(email);
			allowed = await canAccessSharedItem(email, id, roots);
		}
	}

	if (!allowed) throw error(403, 'Forbidden');

	if (row.itemType === 'folder') {
		let buf: Buffer;
		try {
			buf = await buildFolderZipBuffer(id);
		} catch (e) {
			console.error('[download] folder zip failed', e);
			throw error(500, 'Failed to build archive');
		}
		const zipName = zipAttachmentName(row.name);
		return new Response(new Uint8Array(buf), {
			headers: {
				'Content-Type': 'application/zip',
				'Content-Disposition': contentDisposition(zipName),
				'Content-Length': String(buf.length),
				'Cache-Control': 'private, no-store'
			}
		});
	}

	let stored: Buffer;
	try {
		stored = await readStoredBlob(row.path, row.storageProvider);
	} catch (e) {
		console.error('[download] read failed', e);
		throw error(502, 'Failed to read file');
	}

	let body: Buffer;
	try {
		body = openFileBuffer(stored);
	} catch (e) {
		console.error('[download] decrypt/decompress failed', e);
		throw error(500, 'Failed to decode file');
	}

	return new Response(new Uint8Array(body), {
		headers: {
			'Content-Type': effectiveContentType(row.mimeType, row.name),
			'Content-Disposition': contentDisposition(row.name),
			'Content-Length': String(body.length),
			'Cache-Control': 'private, no-store'
		}
	});
};
