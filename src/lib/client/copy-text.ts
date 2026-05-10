/** Copy text to the clipboard (Clipboard API when available, `execCommand` fallback). */
export async function copyTextToClipboard(text: string): Promise<void> {
	if (!text) throw new Error('Nothing to copy');
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return;
		}
	} catch {
		// Continue to legacy fallback (Safari / permission quirks).
	}
	const ta = document.createElement('textarea');
	ta.value = text;
	ta.setAttribute('readonly', '');
	ta.style.position = 'fixed';
	ta.style.left = '-9999px';
	ta.style.top = '0';
	document.body.appendChild(ta);
	ta.focus();
	ta.select();
	ta.setSelectionRange(0, text.length);
	const ok = document.execCommand('copy');
	document.body.removeChild(ta);
	if (!ok) throw new Error('Copy is not supported in this context');
}
