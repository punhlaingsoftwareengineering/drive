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
export const SHARED_FONT_SIZE_STORAGE_KEY = 'phh-ui-font-size';

const FONT_VALUES = new Set<string>(UI_FONT_OPTIONS.map((f) => f.value));
const THEME_SET = new Set<string>(DAISYUI_THEMES);

export const APP_FONT_SIZES = [
	{ value: 'extra-small', label: 'Extra small', scale: 0.8125 },
	{ value: 'smaller', label: 'Smaller', scale: 0.875 },
	{ value: 'normal', label: 'Normal', scale: 1 },
	{ value: 'larger', label: 'Larger', scale: 1.125 },
	{ value: 'extra-large', label: 'Extra large', scale: 1.25 }
] as const;

export type AppFontSize = (typeof APP_FONT_SIZES)[number]['value'];

const VALID_FONT_SIZES = new Set<string>(APP_FONT_SIZES.map((s) => s.value));
const FONT_SIZE_SCALE = Object.fromEntries(
	APP_FONT_SIZES.map((s) => [s.value, s.scale])
) as Record<AppFontSize, number>;

/** @deprecated Prefer APP_FONT_SIZES / named sizes. Kept for older callers. */
export const FONT_SCALE_PRESETS = APP_FONT_SIZES.map((s) => ({
	value: s.scale,
	label: s.label,
	size: s.value
})) as ReadonlyArray<{ value: number; label: string; size: AppFontSize }>;

function clampScale(n: number): number {
	if (Number.isNaN(n)) return 1;
	return Math.min(1.5, Math.max(0.75, n));
}

function scaleToFontSize(n: number): AppFontSize {
	const scale = clampScale(n);
	if (scale <= 0.84) return 'extra-small';
	if (scale <= 0.94) return 'smaller';
	if (scale <= 1.06) return 'normal';
	if (scale <= 1.19) return 'larger';
	return 'extra-large';
}

export function isValidTheme(t: string): t is DaisyTheme {
	return THEME_SET.has(t);
}

export function isValidFont(t: string): t is UiFontValue {
	return FONT_VALUES.has(t);
}

export function isValidFontSize(t: string): t is AppFontSize {
	return VALID_FONT_SIZES.has(t);
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

export function applyFontSize(size: AppFontSize): void {
	if (!browser || !isValidFontSize(size)) return;
	const scale = FONT_SIZE_SCALE[size];
	document.documentElement.dataset.appFontSize = size;
	document.documentElement.style.setProperty('--app-font-scale', String(scale));
	try {
		localStorage.setItem(SHARED_FONT_SIZE_STORAGE_KEY, size);
		localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(scale));
		writeCookie(SHARED_FONT_SIZE_STORAGE_KEY, size);
	} catch {
		/* ignore */
	}
}

/** @deprecated Prefer applyFontSize with named sizes. */
export function applyFontScale(scale: number): void {
	applyFontSize(scaleToFontSize(scale));
}

export function readStoredFontSize(): AppFontSize {
	if (!browser) return 'normal';
	try {
		const named =
			readCookie(SHARED_FONT_SIZE_STORAGE_KEY) ?? localStorage.getItem(SHARED_FONT_SIZE_STORAGE_KEY);
		if (named && isValidFontSize(named)) return named;

		const raw = localStorage.getItem(FONT_SCALE_STORAGE_KEY);
		if (!raw) return 'normal';
		return scaleToFontSize(parseFloat(raw));
	} catch {
		return 'normal';
	}
}

export function readStoredFontScale(): number {
	return FONT_SIZE_SCALE[readStoredFontSize()];
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

	applyFontSize(readStoredFontSize());
}
