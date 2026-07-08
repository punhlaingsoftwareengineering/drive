import { db } from '$lib/server/db';
import { MainFileSchema } from '$lib/server/db/schema/main-schema/main.schema';
import {
	TeamInviteSchema,
	TeamMemberSchema,
	TeamSchema
} from '$lib/server/db/schema/main-schema/team.schema';
import { getUsersByIds } from '$lib/server/auth-user-lookup';
import { isTeamAdminRole, normalizeTeamRole, type TeamRole } from '$lib/model/team-role';
import { isTeamMember, requireTeamMember } from '$lib/server/team-access';
import { uniqueTeamSlug } from '$lib/server/team-slug';
import { localTeamUploadDir } from '$lib/server/local-drive-path';
import { TigrisUtil } from '$lib/service/tigris.service.svelte';
import { isUuidLike } from '$lib/tool/team-slug';
import { and, eq } from 'drizzle-orm';
import { rm } from 'node:fs/promises';

function safeTeamName(name: string): string {
	const t = name.trim().replace(/[/\\]/g, '_');
	return t.slice(0, 200) || 'Team';
}

export async function resolveTeamRouteId(segment: string): Promise<string | null> {
	if (isUuidLike(segment)) {
		const [row] = await db
			.select({ id: TeamSchema.id })
			.from(TeamSchema)
			.where(eq(TeamSchema.id, segment))
			.limit(1);
		return row?.id ?? null;
	}
	const [row] = await db
		.select({ id: TeamSchema.id })
		.from(TeamSchema)
		.where(eq(TeamSchema.slug, segment))
		.limit(1);
	return row?.id ?? null;
}

export async function getTeamMemberRole(userId: string, teamId: string): Promise<TeamRole | null> {
	const [row] = await db
		.select({ role: TeamMemberSchema.role })
		.from(TeamMemberSchema)
		.where(and(eq(TeamMemberSchema.teamId, teamId), eq(TeamMemberSchema.userId, userId)))
		.limit(1);
	if (!row) return null;
	return normalizeTeamRole(row.role);
}

export async function requireTeamOwner(userId: string, teamId: string): Promise<void> {
	const role = await getTeamMemberRole(userId, teamId);
	if (role !== 'owner') {
		throw new Error('Forbidden');
	}
}

export async function requireTeamAdmin(userId: string, teamId: string): Promise<void> {
	const role = await getTeamMemberRole(userId, teamId);
	if (!role || !isTeamAdminRole(role)) {
		throw new Error('Forbidden');
	}
}

export type TeamMemberRow = {
	userId: string;
	role: TeamRole;
	name: string;
	email: string;
};

export type TeamPendingInviteRow = {
	id: string;
	email: string;
	status: string;
};

export async function listTeamMembersAndInvites(teamId: string): Promise<{
	members: TeamMemberRow[];
	pendingInvites: TeamPendingInviteRow[];
}> {
	const memberRows = await db
		.select({
			userId: TeamMemberSchema.userId,
			role: TeamMemberSchema.role
		})
		.from(TeamMemberSchema)
		.where(eq(TeamMemberSchema.teamId, teamId));

	const users = await getUsersByIds(memberRows.map((m) => m.userId));
	const members: TeamMemberRow[] = memberRows.map((m) => {
		const u = users.get(m.userId);
		const email = u?.email ?? '';
		return {
			userId: m.userId,
			role: normalizeTeamRole(m.role),
			name: u?.name?.trim() || email || m.userId,
			email
		};
	});

	const pendingInvites = await db
		.select({
			id: TeamInviteSchema.id,
			email: TeamInviteSchema.email,
			status: TeamInviteSchema.status
		})
		.from(TeamInviteSchema)
		.where(and(eq(TeamInviteSchema.teamId, teamId), eq(TeamInviteSchema.status, 'pending')));

	return { members, pendingInvites };
}

export async function updateTeamName(
	teamId: string,
	actorUserId: string,
	name: string
): Promise<{ name: string; slug: string }> {
	await requireTeamAdmin(actorUserId, teamId);

	const cleanName = safeTeamName(name);
	const [team] = await db
		.select({ id: TeamSchema.id, rootFolderId: TeamSchema.rootFolderId })
		.from(TeamSchema)
		.where(eq(TeamSchema.id, teamId))
		.limit(1);
	if (!team) throw new Error('Team not found');

	const slug = await uniqueTeamSlug(cleanName, teamId);
	await db.update(TeamSchema).set({ name: cleanName, slug }).where(eq(TeamSchema.id, teamId));

	if (team.rootFolderId) {
		await db
			.update(MainFileSchema)
			.set({ name: cleanName })
			.where(eq(MainFileSchema.id, team.rootFolderId));
	}

	return { name: cleanName, slug };
}

export async function updateTeamMemberRole(
	teamId: string,
	actorUserId: string,
	targetUserId: string,
	role: 'admin' | 'member'
): Promise<void> {
	await requireTeamOwner(actorUserId, teamId);

	if (actorUserId === targetUserId) {
		throw new Error('Owners cannot change their own role');
	}

	const targetRole = await getTeamMemberRole(targetUserId, teamId);
	if (!targetRole) throw new Error('Member not found');
	if (targetRole === 'owner') throw new Error('Cannot change the owner role');

	await db
		.update(TeamMemberSchema)
		.set({ role })
		.where(and(eq(TeamMemberSchema.teamId, teamId), eq(TeamMemberSchema.userId, targetUserId)));
}

export async function removeTeamMember(
	teamId: string,
	actorUserId: string,
	targetUserId: string
): Promise<void> {
	if (!(await isTeamMember(actorUserId, teamId))) {
		throw new Error('Forbidden');
	}
	if (!(await isTeamMember(targetUserId, teamId))) {
		throw new Error('Member not found');
	}

	const actorRole = await getTeamMemberRole(actorUserId, teamId);
	const targetRole = await getTeamMemberRole(targetUserId, teamId);

	if (actorUserId === targetUserId) {
		if (targetRole === 'owner') {
			throw new Error('Choose a new owner before leaving the team');
		}
	} else if (actorRole === 'owner') {
		if (targetRole === 'owner') {
			throw new Error('Cannot remove the owner');
		}
	} else if (actorRole === 'admin') {
		if (!targetRole || targetRole !== 'member') {
			throw new Error('Forbidden');
		}
	} else {
		throw new Error('Forbidden');
	}

	await db
		.delete(TeamMemberSchema)
		.where(and(eq(TeamMemberSchema.teamId, teamId), eq(TeamMemberSchema.userId, targetUserId)));
}

export async function leaveTeam(
	teamId: string,
	actorUserId: string,
	newOwnerUserId?: string
): Promise<void> {
	const actorRole = await getTeamMemberRole(actorUserId, teamId);
	if (!actorRole) throw new Error('Forbidden');

	if (actorRole === 'owner') {
		if (!newOwnerUserId) {
			throw new Error('Choose an admin to become the new owner before leaving');
		}
		if (newOwnerUserId === actorUserId) {
			throw new Error('Choose a different admin as the new owner');
		}

		const successorRole = await getTeamMemberRole(newOwnerUserId, teamId);
		if (successorRole !== 'admin') {
			throw new Error('The new owner must be an existing team admin');
		}

		await db
			.update(TeamMemberSchema)
			.set({ role: 'owner' })
			.where(
				and(eq(TeamMemberSchema.teamId, teamId), eq(TeamMemberSchema.userId, newOwnerUserId))
			);

		await db
			.delete(TeamMemberSchema)
			.where(and(eq(TeamMemberSchema.teamId, teamId), eq(TeamMemberSchema.userId, actorUserId)));
		return;
	}

	await db
		.delete(TeamMemberSchema)
		.where(and(eq(TeamMemberSchema.teamId, teamId), eq(TeamMemberSchema.userId, actorUserId)));
}

export async function cancelTeamInvite(
	teamId: string,
	actorUserId: string,
	inviteId: string
): Promise<void> {
	await requireTeamAdmin(actorUserId, teamId);

	const [invite] = await db
		.select({ id: TeamInviteSchema.id })
		.from(TeamInviteSchema)
		.where(and(eq(TeamInviteSchema.id, inviteId), eq(TeamInviteSchema.teamId, teamId)))
		.limit(1);
	if (!invite) throw new Error('Invite not found');

	await db.delete(TeamInviteSchema).where(eq(TeamInviteSchema.id, inviteId));
}

async function deleteTeamStorage(teamId: string, storageProvider: string): Promise<void> {
	if (storageProvider === 'local') {
		await rm(localTeamUploadDir(teamId), { recursive: true, force: true });
		return;
	}

	const files = await db
		.select({ path: MainFileSchema.path, itemType: MainFileSchema.itemType })
		.from(MainFileSchema)
		.where(and(eq(MainFileSchema.teamId, teamId), eq(MainFileSchema.itemType, 'file')));

	for (const file of files) {
		try {
			await TigrisUtil.deleteObject(file.path);
		} catch (e) {
			console.error('[deleteTeam] Tigris delete failed', file.path, e);
		}
	}
}

export async function deleteTeamWithData(teamId: string, actorUserId: string): Promise<void> {
	await requireTeamOwner(actorUserId, teamId);

	const [team] = await db
		.select({ id: TeamSchema.id, storageProvider: TeamSchema.storageProvider })
		.from(TeamSchema)
		.where(eq(TeamSchema.id, teamId))
		.limit(1);
	if (!team) throw new Error('Team not found');

	await deleteTeamStorage(teamId, team.storageProvider);
	await db.delete(TeamSchema).where(eq(TeamSchema.id, teamId));
}
