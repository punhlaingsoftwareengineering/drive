function legacyCopy(text: string): void {
	const ta = document.createElement('textarea');
	ta.value = text;
	ta.setAttribute('readonly', '');
	ta.style.position = 'fixed';
	ta.style.left = '0';
	ta.style.top = '0';
	ta.style.width = '2em';
	ta.style.height = '2em';
	ta.style.padding = '0';
	ta.style.border = 'none';
	ta.style.outline = 'none';
	ta.style.boxShadow = 'none';
	ta.style.background = 'transparent';
	ta.style.opacity = '0';
	document.body.appendChild(ta);
	ta.focus();
	ta.select();
	ta.setSelectionRange(0, text.length);
	let ok = false;
	try {
		ok = document.execCommand('copy');
	} finally {
		document.body.removeChild(ta);
	}
	if (!ok) throw new Error('Copy is not supported in this context');
}

/** Synchronous copy from a visible field — reliable inside `<dialog>` and on HTTP LAN. */
export function copyTextFromInput(input: HTMLInputElement | HTMLTextAreaElement): void {
	const text = input.value;
	if (!text) throw new Error('Nothing to copy');

	const wasReadonly = input.readOnly;
	input.readOnly = false;
	input.focus();
	input.select();
	input.setSelectionRange(0, text.length);
	input.readOnly = wasReadonly;

	if (document.execCommand('copy')) return;
	legacyCopy(text);
}

/** Copy the `input` / `textarea` inside the same `.d-form-control` as `button`. */
export function copyTextFromControlButton(button: HTMLElement): void {
	const field = button.closest('.d-form-control')?.querySelector('input, textarea');
	if (
		!(field instanceof HTMLInputElement) &&
		!(field instanceof HTMLTextAreaElement)
	) {
		throw new Error('No copy field found');
	}
	copyTextFromInput(field);
}

/** Copy text to the clipboard (Clipboard API on HTTPS; sync fallback otherwise). */
export async function copyTextToClipboard(text: string): Promise<void> {
	if (!text) throw new Error('Nothing to copy');

	if (window.isSecureContext && navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}

	legacyCopy(text);
}
