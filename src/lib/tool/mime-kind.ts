const ARCHIVE_EXT_MIME: Record<string, string> = {
	zip: 'application/zip',
	rar: 'application/vnd.rar',
	'7z': 'application/x-7z-compressed',
	gz: 'application/gzip',
	tar: 'application/x-tar',
	bz2: 'application/x-bzip2',
	tgz: 'application/gzip',
	tbz2: 'application/x-bzip2',
	txz: 'application/x-xz',
	xz: 'application/x-xz',
	lz: 'application/x-lzip',
	lzma: 'application/x-lzma',
	zst: 'application/zstd',
	cab: 'application/vnd.ms-cab-compressed',
	jar: 'application/java-archive',
	apk: 'application/vnd.android.package-archive',
	deb: 'application/vnd.debian.binary-package',
	rpm: 'application/x-rpm',
	dmg: 'application/x-apple-diskimage',
	pkg: 'application/x-newton-compatible-pkg',
	msi: 'application/x-msi',
	crx: 'application/x-chrome-extension'
};

/** Longest suffix first so `.tar.gz` wins over `.gz`. */
const COMPOUND_ARCHIVE_SUFFIXES: ReadonlyArray<readonly [suffix: string, mime: string]> = [
	['.tar.gz', 'application/gzip'],
	['.tar.bz2', 'application/x-bzip2'],
	['.tar.xz', 'application/x-xz'],
	['.tar.zst', 'application/zstd'],
	['.tgz', 'application/gzip'],
	['.tbz2', 'application/x-bzip2'],
	['.txz', 'application/x-xz'],
	['.tzst', 'application/zstd']
];

const ARCHIVE_MIME_VALUES = new Set<string>([
	...Object.values(ARCHIVE_EXT_MIME),
	...COMPOUND_ARCHIVE_SUFFIXES.map(([, mime]) => mime),
	'application/x-zip-compressed',
	'application/x-gzip'
]);

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
	...ARCHIVE_EXT_MIME,
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

function guessCompoundArchiveMime(fileName: string): string | undefined {
	const lower = fileName.trim().toLowerCase();
	for (const [suffix, mime] of COMPOUND_ARCHIVE_SUFFIXES) {
		if (lower.endsWith(suffix)) return mime;
	}
	return undefined;
}

/** True when MIME indicates an already-compressed archive (zip, tar, gzip, etc.). */
export function isArchiveMime(mime: string): boolean {
	const m = (mime ?? '').trim().toLowerCase();
	return m !== '' && ARCHIVE_MIME_VALUES.has(m);
}

/** True when MIME is an extension-derived vendor type (application/x-{ext}). */
export function isCustomExtensionMime(mime: string): boolean {
	const m = (mime ?? '').trim().toLowerCase();
	return m.startsWith('application/x-') && !ARCHIVE_MIME_VALUES.has(m);
}

/** Best-effort MIME from file extension. */
export function guessMimeFromFileName(fileName: string): string | undefined {
	const compound = guessCompoundArchiveMime(fileName);
	if (compound) return compound;
	const ext = extensionFromFileName(fileName);
	if (!ext) return undefined;
	return EXT_MIME[ext] ?? `application/x-${ext}`;
}

/** Pick a stored MIME for uploads: trust specific browser types, else guess, else octet-stream. */
export function normalizeUploadMime(
	fileName: string,
	browserMime: string | null | undefined
): string {
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
