import { requireApiSession } from '$lib/server/require-api-session';
import { resolveTeamApiContext } from '$lib/server/team-api-scope';
import { db } from '$lib/server/db';
import { STORAGE_PROVIDERS, type StorageProviderId } from '$lib/model/storage-provider';
import { error, json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

type CategoryRow = { category: string; files: number; bytes: string | bigint | number };
type WeekRow = { week_start: string; file_count: number };

function num(v: string | bigint | number | null | undefined): number {
	if (v === undefined || v === null) return 0;
	return typeof v === 'bigint' ? Number(v) : Number(v);
}

export const GET: RequestHandler = async ({ request, url }) => {
	const session = await requireApiSession(request);
	const userId = session.user.id;
	const teamCtx = await resolveTeamApiContext(userId, url);

	const raw = url.searchParams.get('storageProvider') ?? 'local';
	if (!STORAGE_PROVIDERS.includes(raw as StorageProviderId)) {
		throw error(400, 'Invalid storage provider');
	}
	const storageProvider = teamCtx?.storageProvider ?? (raw as StorageProviderId);

	if (teamCtx) {
		const teamId = teamCtx.teamId;

		const summaryRes = (await db.execute(sql`
			SELECT
				COUNT(*) FILTER (WHERE item_type = 'file' AND trashed_at IS NULL)::int AS files,
				COUNT(*) FILTER (WHERE item_type = 'folder' AND trashed_at IS NULL)::int AS folders,
				COALESCE(SUM(size_bytes) FILTER (WHERE item_type = 'file' AND trashed_at IS NULL), 0)::bigint AS total_bytes,
				COUNT(*) FILTER (WHERE item_type = 'file' AND trashed_at IS NOT NULL)::int AS trashed_files,
				COALESCE(SUM(size_bytes) FILTER (WHERE item_type = 'file' AND trashed_at IS NOT NULL), 0)::bigint AS trashed_bytes,
				COUNT(*) FILTER (WHERE item_type = 'file' AND is_pinned = true AND trashed_at IS NULL)::int AS pinned_files,
				COUNT(*) FILTER (WHERE item_type = 'file' AND is_starred = true AND trashed_at IS NULL)::int AS starred_files
			FROM main_file
			WHERE team_id = ${teamId}::uuid
				AND storage_provider = ${storageProvider}
		`)) as unknown as {
			rows: Array<{
				files: number;
				folders: number;
				total_bytes: string | bigint | number;
				trashed_files: number;
				trashed_bytes: string | bigint | number;
				pinned_files: number;
				starred_files: number;
			}>;
		};

		const summaryRow = summaryRes.rows[0];
		if (!summaryRow) throw error(500, 'Stats query failed');

		const sharesRes = (await db.execute(sql`
			SELECT COUNT(*)::int AS n
			FROM main_file_share s
			INNER JOIN main_file f ON f.id = s.file_id
			WHERE f.team_id = ${teamId}::uuid
				AND f.storage_provider = ${storageProvider}
				AND f.trashed_at IS NULL
		`)) as unknown as { rows: Array<{ n: number }> };

		const categoryRes = (await db.execute(sql`
			SELECT
				CASE
					WHEN mime_type LIKE 'image/%' THEN 'Images'
					WHEN mime_type LIKE 'video/%' THEN 'Video'
					WHEN mime_type LIKE 'audio/%' THEN 'Audio'
					WHEN mime_type = 'application/pdf' OR mime_type LIKE '%pdf%' THEN 'PDF'
					WHEN mime_type LIKE 'text/%' THEN 'Text'
					WHEN mime_type LIKE 'application/%' THEN 'Documents & apps'
					WHEN mime_type = 'application/octet-stream' OR mime_type = '' THEN 'Other'
					ELSE 'Other'
				END AS category,
				COUNT(*)::int AS files,
				COALESCE(SUM(size_bytes), 0)::bigint AS bytes
			FROM main_file
			WHERE team_id = ${teamId}::uuid
				AND storage_provider = ${storageProvider}
				AND item_type = 'file'
				AND trashed_at IS NULL
			GROUP BY 1
			ORDER BY SUM(size_bytes) DESC
		`)) as unknown as { rows: CategoryRow[] };

		const weeksRes = (await db.execute(sql`
			WITH weeks AS (
				SELECT generate_series(
					date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))::date - interval '77 days',
					date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))::date,
					interval '7 days'
				)::date AS week_start
			)
			SELECT w.week_start::text AS week_start, COALESCE(c.n, 0)::int AS file_count
			FROM weeks w
			LEFT JOIN (
				SELECT date_trunc('week', updated_at AT TIME ZONE 'UTC')::date AS week_start, COUNT(*)::int AS n
				FROM main_file
				WHERE team_id = ${teamId}::uuid
					AND storage_provider = ${storageProvider}
					AND item_type = 'file'
					AND trashed_at IS NULL
				GROUP BY 1
			) c ON c.week_start = w.week_start
			ORDER BY w.week_start ASC
		`)) as unknown as { rows: WeekRow[] };

		return json({
			storageProvider,
			summary: {
				files: summaryRow.files,
				folders: summaryRow.folders,
				totalBytes: num(summaryRow.total_bytes),
				trashedFiles: summaryRow.trashed_files,
				trashedBytes: num(summaryRow.trashed_bytes),
				activeShares: sharesRes.rows[0]?.n ?? 0,
				pinnedFiles: summaryRow.pinned_files,
				starredFiles: summaryRow.starred_files
			},
			byCategory: categoryRes.rows.map((r) => ({
				category: r.category,
				files: r.files,
				bytes: num(r.bytes)
			})),
			activityByWeek: weeksRes.rows.map((r) => ({
				weekStart: r.week_start,
				fileCount: r.file_count
			}))
		});
	}

	const summaryRes = (await db.execute(sql`
		SELECT
			COUNT(*) FILTER (WHERE item_type = 'file' AND trashed_at IS NULL)::int AS files,
			COUNT(*) FILTER (WHERE item_type = 'folder' AND trashed_at IS NULL)::int AS folders,
			COALESCE(SUM(size_bytes) FILTER (WHERE item_type = 'file' AND trashed_at IS NULL), 0)::bigint AS total_bytes,
			COUNT(*) FILTER (WHERE item_type = 'file' AND trashed_at IS NOT NULL)::int AS trashed_files,
			COALESCE(SUM(size_bytes) FILTER (WHERE item_type = 'file' AND trashed_at IS NOT NULL), 0)::bigint AS trashed_bytes,
			COUNT(*) FILTER (WHERE item_type = 'file' AND is_pinned = true AND trashed_at IS NULL)::int AS pinned_files,
			COUNT(*) FILTER (WHERE item_type = 'file' AND is_starred = true AND trashed_at IS NULL)::int AS starred_files
		FROM main_file
		WHERE owner_id = ${userId}
			AND team_id IS NULL
			AND storage_provider = ${storageProvider}
	`)) as unknown as {
		rows: Array<{
			files: number;
			folders: number;
			total_bytes: string | bigint | number;
			trashed_files: number;
			trashed_bytes: string | bigint | number;
			pinned_files: number;
			starred_files: number;
		}>;
	};

	const summaryRow = summaryRes.rows[0];
	if (!summaryRow) {
		throw error(500, 'Stats query failed');
	}

	const sharesRes = (await db.execute(sql`
		SELECT COUNT(*)::int AS n
		FROM main_file_share s
		INNER JOIN main_file f ON f.id = s.file_id
		WHERE s.owner_id = ${userId}
			AND f.team_id IS NULL
			AND f.storage_provider = ${storageProvider}
			AND f.trashed_at IS NULL
	`)) as unknown as { rows: Array<{ n: number }> };

	const categoryRes = (await db.execute(sql`
		SELECT
			CASE
				WHEN mime_type LIKE 'image/%' THEN 'Images'
				WHEN mime_type LIKE 'video/%' THEN 'Video'
				WHEN mime_type LIKE 'audio/%' THEN 'Audio'
				WHEN mime_type = 'application/pdf' OR mime_type LIKE '%pdf%' THEN 'PDF'
				WHEN mime_type LIKE 'text/%' THEN 'Text'
				WHEN mime_type LIKE 'application/%' THEN 'Documents & apps'
				WHEN mime_type = 'application/octet-stream' OR mime_type = '' THEN 'Other'
				ELSE 'Other'
			END AS category,
			COUNT(*)::int AS files,
			COALESCE(SUM(size_bytes), 0)::bigint AS bytes
		FROM main_file
		WHERE owner_id = ${userId}
			AND team_id IS NULL
			AND storage_provider = ${storageProvider}
			AND item_type = 'file'
			AND trashed_at IS NULL
		GROUP BY 1
		ORDER BY SUM(size_bytes) DESC
	`)) as unknown as { rows: CategoryRow[] };

	const weeksRes = (await db.execute(sql`
		WITH weeks AS (
			SELECT generate_series(
				date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))::date - interval '77 days',
				date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))::date,
				interval '7 days'
			)::date AS week_start
		)
		SELECT w.week_start::text AS week_start, COALESCE(c.n, 0)::int AS file_count
		FROM weeks w
		LEFT JOIN (
			SELECT date_trunc('week', updated_at AT TIME ZONE 'UTC')::date AS week_start, COUNT(*)::int AS n
			FROM main_file
			WHERE owner_id = ${userId}
				AND team_id IS NULL
				AND storage_provider = ${storageProvider}
				AND item_type = 'file'
				AND trashed_at IS NULL
			GROUP BY 1
		) c ON c.week_start = w.week_start
		ORDER BY w.week_start ASC
	`)) as unknown as { rows: WeekRow[] };

	return json({
		storageProvider,
		summary: {
			files: summaryRow.files,
			folders: summaryRow.folders,
			totalBytes: num(summaryRow.total_bytes),
			trashedFiles: summaryRow.trashed_files,
			trashedBytes: num(summaryRow.trashed_bytes),
			activeShares: sharesRes.rows[0]?.n ?? 0,
			pinnedFiles: summaryRow.pinned_files,
			starredFiles: summaryRow.starred_files
		},
		byCategory: categoryRes.rows.map((r) => ({
			category: r.category,
			files: r.files,
			bytes: num(r.bytes)
		})),
		activityByWeek: weeksRes.rows.map((r) => ({
			weekStart: r.week_start,
			fileCount: r.file_count
		}))
	});
};
