/** True when the file should be treated as an image for previews / direct image URLs. */
export function fileLooksLikeImage(mimeType: string | null | undefined, fileName: string): boolean {
	if (mimeType?.startsWith('image/')) return true;
	return /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(fileName);
}

/** Best-effort MIME when the DB value is missing or generic. */
export function guessImageMimeFromFileName(fileName: string): string | undefined {
	const m = /\.(\w+)$/i.exec(fileName.trim());
	if (!m) return undefined;
	const ext = m[1].toLowerCase();
	const map: Record<string, string> = {
		png: 'image/png',
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		gif: 'image/gif',
		webp: 'image/webp',
		svg: 'image/svg+xml',
		avif: 'image/avif',
		bmp: 'image/bmp',
		ico: 'image/x-icon'
	};
	return map[ext];
}
