import { describe, expect, it } from 'vitest';
import { togglePasswordVisibility } from './password.tool';

describe('togglePasswordVisibility', () => {
	it('inverts the current visibility state', () => {
		expect(togglePasswordVisibility(true)).toBe(false);
		expect(togglePasswordVisibility(false)).toBe(true);
	});

	it('is stable when called repeatedly', () => {
		let value = false;
		value = togglePasswordVisibility(value);
		value = togglePasswordVisibility(value);
		expect(value).toBe(false);
	});
});
