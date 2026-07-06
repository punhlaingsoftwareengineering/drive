import { describe, expect, it } from 'vitest';
import { computeMenuPlacementForViewport } from './drive-menu-placement';

describe('computeMenuPlacementForViewport', () => {
	const menuW = 320;
	const menuH = 280;
	const viewportW = 1024;
	const viewportH = 768;

	function rect(left: number, top: number, width = 32, height = 32) {
		return { left, top, right: left + width, bottom: top + height };
	}

	it('places bottom-left for a trigger on the left with room below', () => {
		const { top, left } = computeMenuPlacementForViewport(rect(48, 120), menuW, menuH, viewportW, viewportH);
		expect(left).toBe(48);
		expect(top).toBe(120 + 32 + 6);
	});

	it('places top-left when the trigger is near the bottom of the viewport', () => {
		const { top, left } = computeMenuPlacementForViewport(rect(48, 700), menuW, menuH, viewportW, viewportH);
		expect(left).toBe(48);
		expect(top).toBe(700 - 280 - 6);
	});

	it('places bottom-right for a trigger on the right edge', () => {
		const { top, left } = computeMenuPlacementForViewport(rect(960, 120), menuW, menuH, viewportW, viewportH);
		expect(left).toBe(960 + 32 - menuW);
		expect(top).toBe(120 + 32 + 6);
	});

	it('clamps inside the viewport margins', () => {
		const { top, left } = computeMenuPlacementForViewport(rect(0, 0), menuW, menuH, viewportW, viewportH);
		expect(left).toBeGreaterThanOrEqual(8);
		expect(top).toBeGreaterThanOrEqual(8);
		expect(left + menuW).toBeLessThanOrEqual(viewportW - 8);
		expect(top + menuH).toBeLessThanOrEqual(viewportH - 8);
	});
});
