import { authDb } from '$lib/server/db/auth-db';
import { isMissingColumnError } from '$lib/server/db-errors';
import { AuthUserSchema } from '$lib/server/db/schema/auth-schema/auth.schema';
import { eq, inArray } from 'drizzle-orm';

export type AuthUserSummary = {
	id: string;
	name: string | null;
	email: string;
	developerModeEnabled: boolean;
};

export function ownerDisplayName(name: string | null | undefined, email: string): string {
	const n = name?.trim();
	return n || email;
}

export async function getUsersByIds(ids: string[]): Promise<Map<string, AuthUserSummary>> {
	const unique = [...new Set(ids.filter(Boolean))];
	const map = new Map<string, AuthUserSummary>();
	if (unique.length === 0) return map;

	try {
		const rows = await authDb
			.select({
				id: AuthUserSchema.id,
				name: AuthUserSchema.name,
				email: AuthUserSchema.email,
				developerModeEnabled: AuthUserSchema.developerModeEnabled
			})
			.from(AuthUserSchema)
			.where(inArray(AuthUserSchema.id, unique));

		for (const row of rows) {
			map.set(row.id, row);
		}
		return map;
	} catch (e) {
		if (!isMissingColumnError(e, 'developer_mode_enabled')) throw e;

		console.warn(
			'[auth] user.developer_mode_enabled missing — run scripts/add-developer-mode-enabled.sql on the shared auth database.'
		);

		const rows = await authDb
			.select({
				id: AuthUserSchema.id,
				name: AuthUserSchema.name,
				email: AuthUserSchema.email
			})
			.from(AuthUserSchema)
			.where(inArray(AuthUserSchema.id, unique));

		for (const row of rows) {
			map.set(row.id, { ...row, developerModeEnabled: false });
		}
		return map;
	}
}

export async function findUsersByEmails(emails: string[]) {
	if (emails.length === 0) return new Map<string, { id: string; email: string }>();
	const rows = await authDb
		.select({ id: AuthUserSchema.id, email: AuthUserSchema.email })
		.from(AuthUserSchema)
		.where(inArray(AuthUserSchema.email, emails));
	const map = new Map<string, { id: string; email: string }>();
	for (const r of rows) {
		map.set(r.email.toLowerCase(), { id: r.id, email: r.email });
	}
	return map;
}

export async function getDeveloperModeEnabled(userId: string): Promise<boolean> {
	try {
		const [row] = await authDb
			.select({ v: AuthUserSchema.developerModeEnabled })
			.from(AuthUserSchema)
			.where(eq(AuthUserSchema.id, userId))
			.limit(1);
		return row?.v ?? false;
	} catch (e) {
		if (isMissingColumnError(e, 'developer_mode_enabled')) {
			console.warn(
				'[auth] user.developer_mode_enabled missing — run scripts/add-developer-mode-enabled.sql on the shared auth database.'
			);
			return false;
		}
		throw e;
	}
}

export async function setDeveloperModeEnabled(userId: string, enabled: boolean): Promise<void> {
	await authDb
		.update(AuthUserSchema)
		.set({ developerModeEnabled: enabled })
		.where(eq(AuthUserSchema.id, userId));
}

export function withOwnerDisplay<T extends { ownerId: string }>(
	rows: T[],
	users: Map<string, AuthUserSummary>
): Array<T & { ownerName: string; ownerEmail: string }> {
	return rows.map((r) => {
		const u = users.get(r.ownerId);
		const email = u?.email ?? '';
		return {
			...r,
			ownerEmail: email,
			ownerName: ownerDisplayName(u?.name, email)
		};
	});
}
