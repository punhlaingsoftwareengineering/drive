import { describe, expect, it } from 'vitest';
import { formatBytes } from './format-bytes';

describe('formatBytes', () => {
	it('returns em dash for null/undefined', () => {
		expect(formatBytes(null)).toBe('—');
		expect(formatBytes(undefined)).toBe('—');
	});

	it('formats 0 as bytes', () => {
		expect(formatBytes(0)).toBe('0 B');
	});

	it('keeps values under 1024 in B with no decimals', () => {
		expect(formatBytes(1)).toBe('1 B');
		expect(formatBytes(999)).toBe('999 B');
	});

	it('formats in KB/MB/GB using binary units', () => {
		expect(formatBytes(1024)).toBe('1.0 KB');
		expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
		expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
	});

	it('uses more precision for small values beyond KB', () => {
		// 1.50 MB should retain two decimals (n < 10 and i > 1)
		expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.50 MB');
	});
});

