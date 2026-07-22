/** Values must match `data-font` selectors in `font.style.css`. */
export const UI_FONT_OPTIONS = [
	{ value: 'maple-mono', label: 'Maple Mono' },
	{ value: 'adwaita-sans', label: 'Adwaita Sans' },
	{ value: 'adwaita-mono', label: 'Adwaita Mono' },
	{ value: 'roboto', label: 'Roboto' },
	{ value: 'arial', label: 'Arial' },
	{ value: 'times-new-roman', label: 'Times New Roman' },
	{ value: 'comic-relief', label: 'Comic Relief' },
	{ value: 'pangolin', label: 'Pangolin' }
] as const;

export type UiFontValue = (typeof UI_FONT_OPTIONS)[number]['value'];
