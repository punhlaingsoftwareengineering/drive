const EXT_MIME: Record<string, string> = {
	// images
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml',
	avif: 'image/avif',
	bmp: 'image/bmp',
	ico: 'image/x-icon',
	heic: 'image/heic',
	heif: 'image/heif',
	// documents
	pdf: 'application/pdf',
	txt: 'text/plain',
	md: 'text/markdown',
	csv: 'text/csv',
	json: 'application/json',
	xml: 'application/xml',
	html: 'text/html',
	htm: 'text/html',
	doc: 'application/msword',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	xls: 'application/vnd.ms-excel',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	ppt: 'application/vnd.ms-powerpoint',
	pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	odt: 'application/vnd.oasis.opendocument.text',
	ods: 'application/vnd.oasis.opendocument.spreadsheet',
	// archives
	zip: 'application/zip',
	rar: 'application/vnd.rar',
	'7z': 'application/x-7z-compressed',
	gz: 'application/gzip',
	tar: 'application/x-tar',
	bz2: 'application/x-bzip2',
	// audio / video
	mp3: 'audio/mpeg',
	wav: 'audio/wav',
	ogg: 'audio/ogg',
	flac: 'audio/flac',
	mp4: 'video/mp4',
	webm: 'video/webm',
	mov: 'video/quicktime',
	mkv: 'video/x-matroska',
	avi: 'video/x-msvideo',
	// code
	js: 'text/javascript',
	mjs: 'text/javascript',
	ts: 'text/typescript',
	css: 'text/css',
	wasm: 'application/wasm'
};

const GENERIC_BROWSER_TYPES = new Set([
	'',
	'application/octet-stream',
	'application/x-msdownload',
	'binary/octet-stream'
]);

function extensionFromFileName(fileName: string): string | undefined {
	const m = /\.([^.]+)$/i.exec(fileName.trim());
	return m?.[1]?.toLowerCase();
}

/** Best-effort MIME from file extension. */
export function guessMimeFromFileName(fileName: string): string | undefined {
	const ext = extensionFromFileName(fileName);
	if (!ext) return undefined;
	return EXT_MIME[ext];
}

/** Pick a stored MIME for uploads: trust specific browser types, else guess, else octet-stream. */
export function normalizeUploadMime(fileName: string, browserMime: string | null | undefined): string {
	const trimmed = (browserMime ?? '').trim().toLowerCase();
	if (trimmed && !GENERIC_BROWSER_TYPES.has(trimmed)) {
		return trimmed;
	}
	return guessMimeFromFileName(fileName) ?? 'application/octet-stream';
}

/** MIME for download/preview headers when DB value is missing or generic. */
export function effectiveContentType(
	storedMime: string | null | undefined,
	fileName: string
): string {
	const stored = (storedMime ?? '').trim().toLowerCase();
	if (stored && !GENERIC_BROWSER_TYPES.has(stored)) {
		return stored;
	}
	return guessMimeFromFileName(fileName) ?? 'application/octet-stream';
}
