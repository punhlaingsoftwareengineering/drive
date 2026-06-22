/** Coerce DB `size_bytes` for JSON API responses (safe up to ~9 PB). */
export function sizeBytesJson(value: bigint | number): number {
	return typeof value === 'bigint' ? Number(value) : value;
}
