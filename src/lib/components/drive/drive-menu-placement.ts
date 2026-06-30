export function computeMenuPlacement(
	btn: HTMLElement,
	menuWidth: number,
	menuHeight: number
): { top: number; left: number } {
	const rect = btn.getBoundingClientRect();
	const gap = 6;
	let left = rect.right - menuWidth;
	left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
	const spaceBelow = window.innerHeight - rect.bottom - gap;
	const spaceAbove = rect.top - gap;
	let top: number;
	if (menuHeight <= spaceBelow || spaceBelow >= spaceAbove) {
		top = rect.bottom + gap;
	} else {
		top = rect.top - menuHeight - gap;
	}
	top = Math.max(8, Math.min(top, window.innerHeight - menuHeight - 8));
	return { top, left };
}
