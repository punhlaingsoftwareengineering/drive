const GAP = 6;
const MARGIN = 8;

type Rect = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>;

/** Pure placement math (viewport size supplied for tests). */
export function computeMenuPlacementForViewport(
	rect: Rect,
	menuWidth: number,
	menuHeight: number,
	viewportW: number,
	viewportH: number
): { top: number; left: number } {
	const spaceBelow = viewportH - rect.bottom - GAP - MARGIN;
	const spaceAbove = rect.top - GAP - MARGIN;
	const spaceRight = viewportW - rect.left - MARGIN;
	const spaceLeft = rect.right - MARGIN;

	const placeBelow = spaceBelow >= menuHeight || spaceBelow >= spaceAbove;
	const alignLeft = spaceRight >= menuWidth || spaceRight >= spaceLeft;

	let top = placeBelow ? rect.bottom + GAP : rect.top - menuHeight - GAP;
	let left = alignLeft ? rect.left : rect.right - menuWidth;

	left = Math.max(MARGIN, Math.min(left, viewportW - menuWidth - MARGIN));
	top = Math.max(MARGIN, Math.min(top, viewportH - menuHeight - MARGIN));

	return { top, left };
}

/** Viewport-aware placement for file action menus (fixed position). */
export function computeMenuPlacement(
	btn: HTMLElement,
	menuWidth: number,
	menuHeight: number
): { top: number; left: number } {
	return computeMenuPlacementForViewport(
		btn.getBoundingClientRect(),
		menuWidth,
		menuHeight,
		window.innerWidth,
		window.innerHeight
	);
}
