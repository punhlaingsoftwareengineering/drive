import {
	sumSubtreeFileBytesForFolderRows,
	sumSubtreeFileBytesForFolders,
	sumSubtreeFileBytesForFoldersTeam
} from '$lib/server/drive-folder-size';
import { sizeBytesJson } from '$lib/server/drive-size-json';
import { requireApiSession } from '$lib/server/require-api-session';
import { db } from '$lib/server/db';
import { AuthUserSchema } from '$lib/server/db/schema/auth-schema/auth.schema';
import { MainFileSchema, MainFileShareSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { TeamMemberSchema, TeamSchema } from '$lib/server/db/schema/main-schema/team.schema';
import { STORAGE_PROVIDERS, type StorageProviderId } from '$lib/model/storage-provider';
import { error, json } from '@sveltejs/kit';
import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const PER_BRANCH = 200;
const MAX_RESULTS = 200;

type Source = 'own' | 'shared' | 'team';

/** PG / Drizzle may return `timestamp` as `Date` or ISO `string` depending on the column and driver. */
function toDate(v: unknown): Date {
	if (v instanceof Date && !Number.isNaN(v.getTime())) {
		return v;
	}
	if (typeof v === 'string' || typeof v === 'number') {
		const d = new Date(v);
		if (!Number.isNaN(d.getTime())) {
			return d;
		}
	}
	return new Date(0);
}

function recencyMs(v: unknown): number {
	return toDate(v).getTime();
}

function ownerDisplayName(name: string | null | undefined, email: string): string {
	const n = name?.trim();
	return n || email;
}

type Merged = {
	id: string;
	ownerId: string;
	name: string;
	itemType: string;
	sizeBytes: number;
	updatedAt: Date;
	storageProvider: StorageProviderId;
	isPinned: boolean;
	isStarred: boolean;
	color: string | null;
	parentId: string | null;
	ownerName: string;
	source: Source;
	recency: Date;
	teamId: string | null;
	teamName: string | null;
	sharePermission: string | null;
};

export const GET: RequestHandler = async ({ request, url }) => {
	const session = await requireApiSession(request);
	const userId = session.user.id;
	const email = session.user.email?.trim().toLowerCase() ?? null;

	const raw = url.searchParams.get('storageProvider') ?? 'local';
	if (!STORAGE_PROVIDERS.includes(raw as StorageProviderId)) {
		throw error(400, 'Invalid storage provider');
	}
	const storageProvider = raw as StorageProviderId;

	const fileFields = {
		id: MainFileSchema.id,
		ownerId: MainFileSchema.ownerId,
		name: MainFileSchema.name,
		itemType: MainFileSchema.itemType,
		sizeBytes: MainFileSchema.sizeBytes,
		updatedAt: MainFileSchema.updatedAt,
		storageProvider: MainFileSchema.storageProvider,
		isPinned: MainFileSchema.isPinned,
		isStarred: MainFileSchema.isStarred,
		color: MainFileSchema.color,
		parentId: MainFileSchema.parentId,
		ownerName: AuthUserSchema.name,
		ownerEmail: AuthUserSchema.email,
		createdAt: MainFileSchema.createdAt
	};

	const ownRows = await db
		.select(fileFields)
		.from(MainFileSchema)
		.innerJoin(AuthUserSchema, eq(MainFileSchema.ownerId, AuthUserSchema.id))
		.where(
			and(
				eq(MainFileSchema.ownerId, userId),
				isNull(MainFileSchema.teamId),
				isNull(MainFileSchema.trashedAt),
				eq(MainFileSchema.storageProvider, storageProvider)
			)
		)
		.orderBy(desc(MainFileSchema.createdAt))
		.limit(PER_BRANCH);

	const sharedRows =
		email ?
			await db
				.select({
					...fileFields,
					shareCreatedAt: MainFileShareSchema.createdAt,
					sharePermission: MainFileShareSchema.permission
				})
				.from(MainFileShareSchema)
				.innerJoin(MainFileSchema, eq(MainFileShareSchema.fileId, MainFileSchema.id))
				.innerJoin(AuthUserSchema, eq(MainFileSchema.ownerId, AuthUserSchema.id))
				.where(
					and(
						eq(MainFileShareSchema.targetEmail, email),
						isNull(MainFileSchema.trashedAt),
						eq(MainFileSchema.storageProvider, storageProvider)
					)
				)
				.orderBy(desc(MainFileShareSchema.createdAt))
				.limit(PER_BRANCH)
		: [];

	const recencyGreatest = sql<Date>`GREATEST(${MainFileSchema.createdAt}, ${TeamMemberSchema.createdAt})`;

	const teamRows = await db
		.select({
			...fileFields,
			teamId: MainFileSchema.teamId,
			teamName: TeamSchema.name,
			recency: recencyGreatest
		})
		.from(MainFileSchema)
		.innerJoin(AuthUserSchema, eq(MainFileSchema.ownerId, AuthUserSchema.id))
		.innerJoin(
			TeamMemberSchema,
			and(
				eq(TeamMemberSchema.teamId, MainFileSchema.teamId),
				eq(TeamMemberSchema.userId, userId)
			)
		)
		.innerJoin(TeamSchema, eq(MainFileSchema.teamId, TeamSchema.id))
		.where(
			and(
				isNotNull(MainFileSchema.teamId),
				isNull(MainFileSchema.trashedAt),
				eq(MainFileSchema.storageProvider, storageProvider)
			)
		)
		.orderBy(desc(recencyGreatest))
		.limit(PER_BRANCH);

	const merged: Merged[] = [];

	for (const r of ownRows) {
		merged.push({
			id: r.id,
			ownerId: r.ownerId,
			name: r.name,
			itemType: r.itemType,
			sizeBytes: sizeBytesJson(r.sizeBytes),
			updatedAt: toDate(r.updatedAt),
			storageProvider: r.storageProvider as StorageProviderId,
			isPinned: r.isPinned,
			isStarred: r.isStarred,
			color: r.color,
			parentId: r.parentId ?? null,
			ownerName: ownerDisplayName(r.ownerName, r.ownerEmail),
			source: 'own',
			recency: toDate(r.createdAt),
			teamId: null,
			teamName: null,
			sharePermission: null
		});
	}

	for (const r of sharedRows) {
		merged.push({
			id: r.id,
			ownerId: r.ownerId,
			name: r.name,
			itemType: r.itemType,
			sizeBytes: sizeBytesJson(r.sizeBytes),
			updatedAt: toDate(r.updatedAt),
			storageProvider: r.storageProvider as StorageProviderId,
			isPinned: r.isPinned,
			isStarred: r.isStarred,
			color: r.color,
			parentId: r.parentId ?? null,
			ownerName: ownerDisplayName(r.ownerName, r.ownerEmail),
			source: 'shared',
			recency: toDate(r.shareCreatedAt),
			teamId: null,
			teamName: null,
			sharePermission: r.sharePermission
		});
	}

	for (const r of teamRows) {
		merged.push({
			id: r.id,
			ownerId: r.ownerId,
			name: r.name,
			itemType: r.itemType,
			sizeBytes: sizeBytesJson(r.sizeBytes),
			updatedAt: toDate(r.updatedAt),
			storageProvider: r.storageProvider as StorageProviderId,
			isPinned: r.isPinned,
			isStarred: r.isStarred,
			color: r.color,
			parentId: r.parentId ?? null,
			ownerName: ownerDisplayName(r.ownerName, r.ownerEmail),
			source: 'team',
			recency: toDate(r.recency),
			teamId: r.teamId,
			teamName: r.teamName,
			sharePermission: null
		});
	}

	const best = new Map<string, Merged>();
	for (const item of merged) {
		const prev = best.get(item.id);
		if (!prev || recencyMs(item.recency) > recencyMs(prev.recency)) {
			best.set(item.id, item);
		}
	}

	const result = Array.from(best.values())
		.sort((a, b) => recencyMs(b.recency) - recencyMs(a.recency))
		.slice(0, MAX_RESULTS);

	const ownFolderIds = result
		.filter((r) => r.source === 'own' && r.itemType === 'folder')
		.map((r) => r.id);
	const ownSubtree = await sumSubtreeFileBytesForFolders(ownFolderIds, userId, storageProvider);

	const sharedFolders = result.filter((r) => r.source === 'shared' && r.itemType === 'folder');
	const sharedSubtree = await sumSubtreeFileBytesForFolderRows(
		sharedFolders.map((r) => ({
			id: r.id,
			ownerId: r.ownerId,
			storageProvider: r.storageProvider
		}))
	);

	const teamFolderByTeam = new Map<string, string[]>();
	for (const r of result) {
		if (r.source !== 'team' || r.itemType !== 'folder' || !r.teamId) continue;
		const list = teamFolderByTeam.get(r.teamId) ?? [];
		list.push(r.id);
		teamFolderByTeam.set(r.teamId, list);
	}
	const teamSubtree = new Map<string, number>();
	for (const [teamId, ids] of teamFolderByTeam) {
		const m = await sumSubtreeFileBytesForFoldersTeam(ids, teamId, storageProvider);
		for (const [id, n] of m) teamSubtree.set(id, n);
	}

	return json({
		files: result.map((r) => {
			let size = r.sizeBytes;
			if (r.itemType === 'folder') {
				if (r.source === 'own') size = ownSubtree.get(r.id) ?? 0;
				else if (r.source === 'shared') size = sharedSubtree.get(r.id) ?? 0;
				else if (r.source === 'team' && r.teamId) size = teamSubtree.get(r.id) ?? 0;
			}
			return {
				id: r.id,
				name: r.name,
				itemType: r.itemType,
				sizeBytes: size,
				updatedAt: r.updatedAt.toISOString(),
				recencyAt: r.recency.toISOString(),
				storageProvider: r.storageProvider,
				isPinned: r.isPinned,
				isStarred: r.isStarred,
				color: r.color,
				parentId: r.parentId,
				ownerName: r.ownerName,
				source: r.source,
				teamId: r.teamId,
				teamName: r.teamName,
				sharePermission: r.sharePermission
			};
		})
	});
};
