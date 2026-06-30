import { describe, expect, it } from 'vitest';
import { getUserInitials } from './user-initials';

describe('getUserInitials', () => {
	it('returns ? when user is missing', () => {
		expect(getUserInitials(null)).toBe('?');
		expect(getUserInitials(undefined)).toBe('?');
	});

	it('uses first + last initial for multi-part names', () => {
		expect(getUserInitials({ name: 'Ada Lovelace' })).toBe('AL');
		expect(getUserInitials({ name: '  grace   hopper  ' })).toBe('GH');
		expect(getUserInitials({ name: 'Jean   Baptiste   Fourier' })).toBe('JF');
	});

	it('uses first two characters for single-part names', () => {
		expect(getUserInitials({ name: 'Ada' })).toBe('AD');
		expect(getUserInitials({ name: '  Ö  ' })).toBe('Ö');
	});

	it('falls back to email local-part when name is empty', () => {
		expect(getUserInitials({ name: '   ', email: 'user@example.com' })).toBe('US');
		expect(getUserInitials({ email: 'a@b.c' })).toBe('A');
	});

	it('returns ? when name and email are empty', () => {
		expect(getUserInitials({ name: '   ', email: '   ' })).toBe('?');
	});
});
