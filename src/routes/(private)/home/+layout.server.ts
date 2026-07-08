import { resolve } from '$app/paths';
import { resolveHref } from '$lib/url/resolve-href';
import { getDeveloperModeEnabled } from '$lib/server/auth-user-lookup';
import { portalLoginUrl } from '$lib/server/portal-origin';
import { getConfiguredOrigin } from '$lib/server/public-origin';
import { canAccessSharedItem, sharedRootIdsForRecipient } from '$lib/server/drive-shared-access';
import { db } from '$lib/server/db';
import { MainFileSchema } from '$lib/server/db/schema/main-schema/main.schema';
import { TeamSchema } from '$lib/server/db/schema/main-schema/team.schema';
import { isTeamMember, listTeamsForUser } from '$lib/server/team-access';
import {
	isTeamScopeSubpath,
	parseTeamScopeView,
	type TeamScopeView
} from '$lib/model/team-scope';
import { pathWithoutBase } from '$lib/url/path-without-base';
import { listFolderAncestors, type FolderAncestor } from '$lib/server/drive-folder-ancestors';
import { isUuidLike } from '$lib/tool/team-slug';
import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

/** Migration `0003_team_drive` not applied — team / team_member tables are missing. */
function isMissingRelationError(e: unknown): boolean {
	const code = (e as { cause?: { code?: string } })?.cause?.code;
	if (code === '42P01') return true;
	const msg = e instanceof Error ? e.message : String(e);
	if (/relation "team"/i.test(msg) && /does not exist/i.test(msg)) return true;
	if (/42P01/i.test(msg)) return true;
	return false;
}

function readAppVersion(): string {
	try {
		const raw = readFileSync(join(process.cwd(), 'package.json'), 'utf-8');
		const j = JSON.parse(raw) as { version?: string };
		return typeof j.version === 'string' ? j.version : '0.0.1';
	} catch {
		return '0.0.1';
	}
}

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		const returnTo = getConfiguredOrigin()
			? `${getConfiguredOrigin()}${url.pathname}${url.search}`
			: undefined;
		throw redirect(303, portalLoginUrl(returnTo));
	}

	const rel = pathWithoutBase(url.pathname);
	const teamPathMatch = rel.match(/^\/home\/team\/([^/]+)(?:\/([^/]+))?\/?$/);
	const teamSegment = teamPathMatch?.[1] ?? null;
	const teamSubPathRaw = teamPathMatch?.[2] ?? null;
	const isHomeFilesPage = rel === '/home';
	const isSharedPage = rel === '/home/shared';
	const isTrashPage = rel === '/home/trash';
	const isRecentPage = rel === '/home/recent';

	const folderParamEarly = url.searchParams.get('folder');
	if (isRecentPage && folderParamEarly && folderParamEarly.trim() !== '') {
		throw redirect(303, resolve('/home/recent'));
	}

	const teams = await listTeamsForUser(locals.user.id);

	let teamView: {
		id: string;
		name: string;
		slug: string;
		rootFolderId: string;
		storageProvider: 'local' | 'tigris';
	} | null = null;
	let teamRouteId: string | null = null;
	let teamScopeView: TeamScopeView | null = null;

	if (teamSegment) {
		if (teamSubPathRaw && !isTeamScopeSubpath(teamSubPathRaw)) {
			throw redirect(303, resolveHref(`/home/team/${teamSegment}`));
		}

		const [t] = isUuidLike(teamSegment)
			? await db
					.select({
						id: TeamSchema.id,
						name: TeamSchema.name,
						slug: TeamSchema.slug,
						rootFolderId: TeamSchema.rootFolderId,
						storageProvider: TeamSchema.storageProvider
					})
					.from(TeamSchema)
					.where(eq(TeamSchema.id, teamSegment))
					.limit(1)
			: await db
					.select({
						id: TeamSchema.id,
						name: TeamSchema.name,
						slug: TeamSchema.slug,
						rootFolderId: TeamSchema.rootFolderId,
						storageProvider: TeamSchema.storageProvider
					})
					.from(TeamSchema)
					.where(eq(TeamSchema.slug, teamSegment))
					.limit(1);

		if (isUuidLike(teamSegment) && t?.slug && t.slug !== teamSegment) {
			const subSuffix = teamSubPathRaw ? `/${teamSubPathRaw}` : '';
			const dest = resolveHref(`/home/team/${t.slug}${subSuffix}`);
			const qs = url.searchParams.toString();
			throw redirect(303, qs ? `${dest}?${qs}` : dest);
		}

		if (!t?.rootFolderId || !(await isTeamMember(locals.user.id, t.id))) {
			throw redirect(303, '/home');
		}

		teamRouteId = t.id;
		teamView = {
			id: t.id,
			name: t.name,
			slug: t.slug,
			rootFolderId: t.rootFolderId,
			storageProvider: t.storageProvider as 'local' | 'tigris'
		};
		teamScopeView = parseTeamScopeView(teamSubPathRaw);
	}

	if (teamScopeView === 'recent' && folderParamEarly && folderParamEarly.trim() !== '') {
		throw redirect(303, resolveHref(`/home/team/${teamView!.slug}/recent`));
	}
	if (teamScopeView === 'trash' && folderParamEarly && folderParamEarly.trim() !== '') {
		throw redirect(303, resolveHref(`/home/team/${teamView!.slug}/trash`));
	}
	if (
		(teamScopeView === 'dashboard' || teamScopeView === 'settings') &&
		folderParamEarly &&
		folderParamEarly.trim() !== ''
	) {
		throw redirect(303, resolveHref(`/home/team/${teamView!.slug}/${teamScopeView}`));
	}

	const folderParam = url.searchParams.get('folder');
	let currentFolder: {
		id: string;
		name: string;
		parentId: string | null;
		upHref: string;
	} | null = null;

	const email = locals.user.email?.trim().toLowerCase();

	if (folderParam && folderParam.trim() !== '') {
		const parsed = z.string().uuid().safeParse(folderParam.trim());
		if (!parsed.success) {
			const teamHome = teamRouteId && teamView ? resolveHref(`/home/team/${teamView.slug}`) : null;
			const teamShared =
				teamRouteId && teamView && teamScopeView === 'shared'
					? resolveHref(`/home/team/${teamView.slug}/shared`)
					: null;
			throw redirect(
				303,
				isSharedPage
					? resolve('/home/shared')
					: teamShared ?? teamHome ?? resolve('/home')
			);
		}

		if (isSharedPage) {
			if (!email) {
				throw redirect(303, resolve('/home/shared'));
			}
			const sharedRoots = await sharedRootIdsForRecipient(email);
			if (!(await canAccessSharedItem(email, parsed.data, sharedRoots))) {
				throw redirect(303, resolve('/home/shared'));
			}

			const [row] = await db
				.select({
					id: MainFileSchema.id,
					name: MainFileSchema.name,
					parentId: MainFileSchema.parentId,
					itemType: MainFileSchema.itemType
				})
				.from(MainFileSchema)
				.where(and(eq(MainFileSchema.id, parsed.data), isNull(MainFileSchema.trashedAt)))
				.limit(1);

			if (!row || row.itemType !== 'folder') {
				throw redirect(303, resolve('/home/shared'));
			}

			let upHref: string = resolve('/home/shared');
			if (row.parentId) {
				const canUp = await canAccessSharedItem(email, row.parentId, sharedRoots);
				upHref = canUp
					? `${resolve('/home/shared')}?folder=${encodeURIComponent(row.parentId)}`
					: resolve('/home/shared');
			}

			currentFolder = {
				id: row.id,
				name: row.name,
				parentId: row.parentId ?? null,
				upHref
			};
		} else if (isHomeFilesPage) {
			const [row] = await db
				.select({
					id: MainFileSchema.id,
					name: MainFileSchema.name,
					parentId: MainFileSchema.parentId,
					itemType: MainFileSchema.itemType
				})
				.from(MainFileSchema)
				.where(
					and(
						eq(MainFileSchema.id, parsed.data),
						eq(MainFileSchema.ownerId, locals.user.id),
						isNull(MainFileSchema.teamId),
						isNull(MainFileSchema.trashedAt)
					)
				)
				.limit(1);

			if (!row || row.itemType !== 'folder') {
				throw redirect(303, resolve('/home'));
			}

			const upHref: string = row.parentId
				? `${resolve('/home')}?folder=${encodeURIComponent(row.parentId)}`
				: resolve('/home');

			currentFolder = {
				id: row.id,
				name: row.name,
				parentId: row.parentId ?? null,
				upHref
			};
		} else if (teamRouteId && teamView && teamScopeView === 'shared') {
			const [row] = await db
				.select({
					id: MainFileSchema.id,
					name: MainFileSchema.name,
					parentId: MainFileSchema.parentId,
					itemType: MainFileSchema.itemType
				})
				.from(MainFileSchema)
				.where(
					and(
						eq(MainFileSchema.id, parsed.data),
						eq(MainFileSchema.teamId, teamRouteId),
						isNull(MainFileSchema.trashedAt)
					)
				)
				.limit(1);

			const sharedBase = resolveHref(`/home/team/${teamView.slug}/shared`);
			if (!row || row.itemType !== 'folder') {
				throw redirect(303, sharedBase);
			}

			const upHref: string =
				!row.parentId || row.parentId === teamView.rootFolderId
					? sharedBase
					: `${sharedBase}?folder=${encodeURIComponent(row.parentId)}`;

			currentFolder = {
				id: row.id,
				name: row.name,
				parentId: row.parentId ?? null,
				upHref
			};
		} else if (teamRouteId && teamView && teamScopeView === 'home') {
			const [row] = await db
				.select({
					id: MainFileSchema.id,
					name: MainFileSchema.name,
					parentId: MainFileSchema.parentId,
					itemType: MainFileSchema.itemType,
					teamId: MainFileSchema.teamId
				})
				.from(MainFileSchema)
				.where(
					and(
						eq(MainFileSchema.id, parsed.data),
						eq(MainFileSchema.teamId, teamRouteId),
						isNull(MainFileSchema.trashedAt)
					)
				)
				.limit(1);

			if (!row || row.itemType !== 'folder') {
				throw redirect(303, resolveHref(`/home/team/${teamView!.slug}`));
			}

			const base = resolveHref(`/home/team/${teamView.slug}`);
			const upHref: string =
				!row.parentId || row.parentId === teamView.rootFolderId
					? base
					: `${base}?folder=${encodeURIComponent(row.parentId)}`;

			currentFolder = {
				id: row.id,
				name: row.name,
				parentId: row.parentId ?? null,
				upHref
			};
		}
	}

	let folderAncestors: FolderAncestor[] = [];
	if (currentFolder) {
		if (isSharedPage) {
			folderAncestors = await listFolderAncestors(
				currentFolder.parentId,
				null,
				(id) => `${resolve('/home/shared')}?folder=${encodeURIComponent(id)}`
			);
		} else if (isHomeFilesPage) {
			folderAncestors = await listFolderAncestors(
				currentFolder.parentId,
				null,
				(id) => `${resolve('/home')}?folder=${encodeURIComponent(id)}`
			);
		} else if (teamView && teamScopeView === 'shared') {
			folderAncestors = await listFolderAncestors(
				currentFolder.parentId,
				teamView.rootFolderId,
				(id) =>
					`${resolveHref(`/home/team/${teamView.slug}/shared`)}?folder=${encodeURIComponent(id)}`
			);
		} else if (teamView && teamScopeView === 'home') {
			folderAncestors = await listFolderAncestors(
				currentFolder.parentId,
				teamView.rootFolderId,
				(id) =>
					`${resolveHref(`/home/team/${teamView.slug}`)}?folder=${encodeURIComponent(id)}`
			);
		}
	}

	let developerModeEnabled = false;
	if (locals.user?.id) {
		developerModeEnabled = await getDeveloperModeEnabled(locals.user.id);
	}

	return {
		user: locals.user ?? null,
		appVersion: readAppVersion(),
		developerModeEnabled,
		currentFolder,
		folderAncestors,
		sharedView: isSharedPage,
		recentView: isRecentPage,
		trashView: isTrashPage,
		teams,
		teamView,
		teamScopeView
	};
};
