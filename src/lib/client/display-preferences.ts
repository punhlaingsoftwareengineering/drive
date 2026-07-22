import { browser } from '$app/environment';
import type { DaisyTheme } from '$lib/user-settings/daisy-themes';
import { DAISYUI_THEMES } from '$lib/user-settings/daisy-themes';
import type { UiFontValue } from '$lib/user-settings/ui-fonts';
import { UI_FONT_OPTIONS } from '$lib/user-settings/ui-fonts';

export const THEME_STORAGE_KEY = 'theme';
export const FONT_STORAGE_KEY = 'font';
export const FONT_SCALE_STORAGE_KEY = 'uiFontScale';
export const SHARED_THEME_STORAGE_KEY = 'phh-ui-theme';
export const SHARED_FONT_STORAGE_KEY = 'phh-ui-font';

const FONT_VALUES = new Set<string>(UI_FONT_OPTIONS.map((f) => f.value));
const THEME_SET = new Set<string>(DAISYUI_THEMES);

export const FONT_SCALE_PRESETS = [
	{ value: 0.875, label: 'Smaller' },
	{ value: 1, label: 'Default' },
	{ value: 1.125, label: 'Larger' },
	{ value: 1.25, label: 'Largest' }
] as const;

function clampScale(n: number): number {
	if (Number.isNaN(n)) return 1;
	return Math.min(1.5, Math.max(0.75, n));
}

export function isValidTheme(t: string): t is DaisyTheme {
	return THEME_SET.has(t);
}

export function isValidFont(t: string): t is UiFontValue {
	return FONT_VALUES.has(t);
}

function getCookieDomain(): string | null {
	if (!browser) return null;
	const { hostname } = window.location;
	if (
		hostname === 'localhost' ||
		hostname.endsWith('.localhost') ||
		/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
	) {
		return null;
	}

	const parts = hostname.split('.').filter(Boolean);
	if (parts.length < 2) return null;
	return `.${parts.slice(-2).join('.')}`;
}

function readCookie(name: string): string | null {
	if (!browser) return null;
	const prefix = `${name}=`;
	for (const part of document.cookie.split(';')) {
		const trimmed = part.trim();
		if (trimmed.startsWith(prefix)) {
			return decodeURIComponent(trimmed.slice(prefix.length));
		}
	}
	return null;
}

function writeCookie(name: string, value: string) {
	if (!browser) return;
	const domain = getCookieDomain();
	const domainPart = domain ? `; domain=${domain}` : '';
	document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax${domainPart}`;
}

function normalizeLegacyFont(value: string | null): string | null {
	if (!value) return null;
	switch (value) {
		case 'Adwaita-sans':
			return 'adwaita-sans';
		case 'Adwaita-mono':
			return 'adwaita-mono';
		case 'Roboto':
			return 'roboto';
		case 'Comic-relief':
			return 'comic-relief';
		case 'Pangolin':
			return 'pangolin';
		default:
			return value.toLowerCase();
	}
}

export function applyTheme(theme: string): void {
	if (!browser || !isValidTheme(theme)) return;
	document.documentElement.setAttribute('data-theme', theme);
	try {
		localStorage.setItem(THEME_STORAGE_KEY, theme);
		localStorage.setItem(SHARED_THEME_STORAGE_KEY, theme);
		writeCookie(SHARED_THEME_STORAGE_KEY, theme);
	} catch {
		/* ignore */
	}
}

export function applyFont(font: string): void {
	if (!browser || !isValidFont(font)) return;
	document.documentElement.setAttribute('data-font', font);
	try {
		localStorage.setItem(FONT_STORAGE_KEY, font);
		localStorage.setItem(SHARED_FONT_STORAGE_KEY, font);
		writeCookie(SHARED_FONT_STORAGE_KEY, font);
	} catch {
		/* ignore */
	}
}

export function applyFontScale(scale: number): void {
	if (!browser) return;
	const s = clampScale(scale);
	document.documentElement.style.setProperty('--app-font-scale', String(s));
	try {
		localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(s));
	} catch {
		/* ignore */
	}
}

export function readStoredFontScale(): number {
	if (!browser) return 1;
	try {
		const raw = localStorage.getItem(FONT_SCALE_STORAGE_KEY);
		if (!raw) return 1;
		return clampScale(parseFloat(raw));
	} catch {
		return 1;
	}
}

export function syncSharedAppearance(): void {
	if (!browser) return;
	const theme =
		readCookie(SHARED_THEME_STORAGE_KEY) ?? localStorage.getItem(SHARED_THEME_STORAGE_KEY);
	if (theme && isValidTheme(theme)) {
		applyTheme(theme);
	}

	const font =
		normalizeLegacyFont(readCookie(SHARED_FONT_STORAGE_KEY)) ??
		normalizeLegacyFont(localStorage.getItem(SHARED_FONT_STORAGE_KEY)) ??
		normalizeLegacyFont(localStorage.getItem(FONT_STORAGE_KEY));
	if (font && isValidFont(font)) {
		applyFont(font);
	}
}
