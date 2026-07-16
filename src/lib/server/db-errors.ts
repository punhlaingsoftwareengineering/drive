/** Postgres undefined_table */
export function isMissingRelationError(e: unknown): boolean {
	const code = (e as { cause?: { code?: string } })?.cause?.code;
	if (code === '42P01') return true;
	const msg = e instanceof Error ? e.message : String(e);
	if (/relation "[^"]+"/i.test(msg) && /does not exist/i.test(msg)) return true;
	return /42P01/i.test(msg);
}

/** Postgres undefined_column */
export function isMissingColumnError(e: unknown, column?: string): boolean {
	const code = (e as { cause?: { code?: string } })?.cause?.code;
	if (code === '42703') return column ? matchesColumn(e, column) : true;
	return column ? matchesColumn(e, column) : /42703/i.test(String(e));
}

function matchesColumn(e: unknown, column: string): boolean {
	const msg = e instanceof Error ? e.message : String(e);
	return msg.toLowerCase().includes(column.toLowerCase()) && /does not exist/i.test(msg);
}
