import { db } from '$lib/server/db';
import { AuthUserSchema } from '$lib/server/db/schema/auth-schema/auth.schema';
import { TeamMemberSchema, TeamSchema } from '$lib/server/db/schema/main-schema/team.schema';
import { and, desc, eq, inArray } from 'drizzle-orm';

export async function isTeamMember(userId: string, teamId: string): Promise<boolean> {
	const [m] = await db
		.select({ one: TeamMemberSchema.id })
		.from(TeamMemberSchema)
		.where(and(eq(TeamMemberSchema.userId, userId), eq(TeamMemberSchema.teamId, teamId)))
		.limit(1);
	return Boolean(m);
}

export async function listTeamsForUser(
	userId: string
): Promise<Array<{ id: string; name: string }>> {
	return db
		.select({ id: TeamSchema.id, name: TeamSchema.name })
		.from(TeamSchema)
		.innerJoin(TeamMemberSchema, eq(TeamMemberSchema.teamId, TeamSchema.id))
		.where(eq(TeamMemberSchema.userId, userId))
		.orderBy(desc(TeamSchema.createdAt));
}

export async function userCanAccessFile(
	userId: string,
	row: { ownerId: string; teamId: string | null }
): Promise<boolean> {
	if (!row.teamId) {
		return row.ownerId === userId;
	}
	return isTeamMember(userId, row.teamId);
}

export async function findUsersByEmails(emails: string[]) {
	if (emails.length === 0) return new Map<string, { id: string; email: string }>();
	const rows = await db
		.select({ id: AuthUserSchema.id, email: AuthUserSchema.email })
		.from(AuthUserSchema)
		.where(inArray(AuthUserSchema.email, emails));
	const map = new Map<string, { id: string; email: string }>();
	for (const r of rows) {
		map.set(r.email.toLowerCase(), { id: r.id, email: r.email });
	}
	return map;
}
