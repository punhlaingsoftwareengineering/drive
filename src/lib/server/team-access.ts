import { db } from '$lib/server/db';
import { TeamMemberSchema, TeamSchema } from '$lib/server/db/schema/main-schema/team.schema';
import { error } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';

export async function requireTeamMember(userId: string, teamId: string): Promise<void> {
	if (!(await isTeamMember(userId, teamId))) {
		throw error(403, 'Forbidden');
	}
}

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
): Promise<Array<{ id: string; name: string; slug: string }>> {
	return db
		.select({ id: TeamSchema.id, name: TeamSchema.name, slug: TeamSchema.slug })
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
