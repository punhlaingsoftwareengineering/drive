import { error, isHttpError } from '@sveltejs/kit';

type UploadErrorContext = {
	route: string;
	userId?: string;
	storageProvider?: string;
	fileName?: string;
	bytes?: number;
	parentId?: string | null;
	teamId?: string | null;
};

function hasCode(e: unknown, code: string): boolean {
	return (
		typeof e === 'object' &&
		e !== null &&
		'code' in e &&
		(e as { code?: string }).code === code
	);
}

/** Map persistence failures to HTTP errors; rethrow existing HttpErrors unchanged. */
export function throwMappedUploadError(e: unknown, ctx: UploadErrorContext): never {
	if (isHttpError(e)) throw e;

	const msg = e instanceof Error ? e.message : 'Upload failed';

	if (msg.includes('Set DRIVE_ENCRYPTION_KEY') || msg.includes('BETTER_AUTH_SECRET')) {
		console.error(`[${ctx.route}] encryption config`, ctx, e);
		throw error(500, msg);
	}

	if (hasCode(e, 'EACCES') || hasCode(e, 'EROFS')) {
		console.error(`[${ctx.route}] storage not writable`, ctx, e);
		throw error(
			507,
			'Local storage is not writable. Check LOCAL_DRIVE_DATA_DIR permissions or mount a volume.'
		);
	}

	if (
		msg.includes('connect') ||
		msg.includes('ECONNREFUSED') ||
		msg.includes('Connection') ||
		hasCode(e, 'ECONNREFUSED')
	) {
		console.error(`[${ctx.route}] database unavailable`, ctx, e);
		throw error(503, 'Database temporarily unavailable');
	}

	if (msg.includes('Invalid chunk') || msg.includes('session') || msg.includes('Expected chunk')) {
		throw error(400, msg);
	}

	if (msg.includes('too large') || msg.includes('File too large')) {
		throw error(413, msg);
	}

	if (hasCode(e, 'ENOMEM')) {
		console.error(`[${ctx.route}] out of memory`, ctx, e);
		throw error(507, 'Server ran out of memory while processing the upload');
	}

	if (hasCode(e, 'ENOSPC')) {
		console.error(`[${ctx.route}] disk full`, ctx, e);
		throw error(507, 'Storage disk is full. Free space or expand the volume.');
	}

	console.error(`[${ctx.route}]`, ctx, e);
	throw error(500, msg);
}
