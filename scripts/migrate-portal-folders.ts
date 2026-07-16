/**
 * One-time migration: move orphan `portal/` folders (parent_id NULL) under the team root
 * and merge duplicate portal trees when a canonical portal already exists.
 *
 * Usage (from drive repo):
 *   DATABASE_URL=postgres://.../db_drive \
 *   LOCAL_DRIVE_DATA_DIR=/data/znl-drive \
 *   npx tsx scripts/migrate-portal-folders.ts
 *
 * Dry run:
 *   DRY_RUN=1 npx tsx scripts/migrate-portal-folders.ts
 */
import pg from 'pg';
import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';

const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const driveUrl = process.env.DATABASE_URL?.trim();

if (!driveUrl) {
	console.error('Set DATABASE_URL (drive DB).');
	process.exit(1);
}

const pool = new pg.Pool({ connectionString: driveUrl });

const PORTAL_FOLDER_NAME = 'portal';

type MainFileRow = {
	id: string;
	name: string;
	item_type: 'file' | 'folder';
	parent_id: string | null;
	path: string;
	team_id: string | null;
	owner_id: string;
	storage_provider: string;
	sort_order: number;
};

type TeamRow = {
	id: string;
	name: string;
	root_folder_id: string | null;
	created_by_user_id: string;
	storage_provider: string;
};

function replacePathPrefix(oldPrefix: string, newPrefix: string, path: string): string {
	if (path === oldPrefix) return newPrefix;
	const oldWithSep = oldPrefix.endsWith('/') ? oldPrefix : oldPrefix + sep;
	if (path.startsWith(oldWithSep)) {
		const suffix = path.slice(oldWithSep.length);
		return newPrefix.endsWith('/') ? newPrefix + suffix : join(newPrefix, suffix);
	}
	const oldSlash = oldPrefix.endsWith('/') ? oldPrefix : `${oldPrefix}/`;
	if (path.startsWith(oldSlash)) {
		const suffix = path.slice(oldSlash.length);
		const newSlash = newPrefix.endsWith('/') ? newPrefix : `${newPrefix}/`;
		return newSlash + suffix;
	}
	return path;
}

function localPathNewSubfolder(parentFolderAbsPath: string, folderId: string): string {
	return join(parentFolderAbsPath, 'folder', folderId);
}

function localPathNewFileInsideFolder(
	parentFolderAbsPath: string,
	fileId: string,
	safeName: string
): string {
	return join(parentFolderAbsPath, `${fileId}-${safeName}`);
}

function computeNewStoredPath(
	row: Pick<MainFileRow, 'id' | 'name' | 'item_type'>,
	parentFolderPath: string | null
): string {
	if (row.item_type === 'folder') {
		return parentFolderPath
			? localPathNewSubfolder(parentFolderPath, row.id)
			: row.path;
	}
	return parentFolderPath
		? localPathNewFileInsideFolder(parentFolderPath, row.id, row.name)
		: row.path;
}

async function collectSubtree(client: pg.PoolClient, rootId: string): Promise<MainFileRow[]> {
	const { rows } = await client.query<MainFileRow>(
		`WITH RECURSIVE sub AS (
			SELECT id, name, item_type::text AS item_type, parent_id, path, team_id, owner_id,
			       storage_provider::text AS storage_provider, sort_order
			FROM main_file
			WHERE id = $1::uuid
			UNION ALL
			SELECT m.id, m.name, m.item_type::text, m.parent_id, m.path, m.team_id, m.owner_id,
			       m.storage_provider::text, m.sort_order
			FROM main_file m
			INNER JOIN sub s ON m.parent_id = s.id
		)
		SELECT id, name, item_type, parent_id, path, team_id, owner_id, storage_provider, sort_order
		FROM sub`,
		[rootId]
	);
	return rows;
}

async function nextSortOrder(
	client: pg.PoolClient,
	parentId: string | null,
	teamId: string
): Promise<number> {
	const { rows } = await client.query<{ max: number | null }>(
		`SELECT COALESCE(MAX(sort_order), -1) + 1 AS max
		 FROM main_file
		 WHERE team_id = $1::uuid
		   AND storage_provider = 'local'::master_storage_provider
		   AND trashed_at IS NULL
		   AND parent_id IS NOT DISTINCT FROM $2::uuid`,
		[teamId, parentId]
	);
	return rows[0]?.max ?? 0;
}

async function getChildren(
	client: pg.PoolClient,
	parentId: string
): Promise<MainFileRow[]> {
	const { rows } = await client.query<MainFileRow>(
		`SELECT id, name, item_type::text AS item_type, parent_id, path, team_id, owner_id,
		        storage_provider::text AS storage_provider, sort_order
		 FROM main_file
		 WHERE parent_id = $1::uuid
		   AND trashed_at IS NULL
		 ORDER BY sort_order, name`,
		[parentId]
	);
	return rows;
}

async function findChildByName(
	client: pg.PoolClient,
	parentId: string,
	name: string,
	itemType: 'file' | 'folder'
): Promise<MainFileRow | null> {
	const { rows } = await client.query<MainFileRow>(
		`SELECT id, name, item_type::text AS item_type, parent_id, path, team_id, owner_id,
		        storage_provider::text AS storage_provider, sort_order
		 FROM main_file
		 WHERE parent_id = $1::uuid
		   AND name = $2
		 AND item_type = $3
		   AND trashed_at IS NULL
		 LIMIT 1`,
		[parentId, name, itemType]
	);
	return rows[0] ?? null;
}

async function moveItemToParent(
	client: pg.PoolClient,
	item: MainFileRow,
	targetParentId: string,
	targetFolderPath: string,
	teamId: string
): Promise<void> {
	const currentParent = item.parent_id;
	if (currentParent === targetParentId) return;

	const newPath = computeNewStoredPath(item, targetFolderPath);
	const sortOrder = await nextSortOrder(client, targetParentId, teamId);

	console.log(
		`    move ${item.item_type} "${item.name}" (${item.id}) -> parent ${targetParentId}`
	);

	if (dryRun) return;

	await mkdir(dirname(newPath), { recursive: true });
	await rename(item.path, newPath);

	await client.query(
		`UPDATE main_file SET parent_id = $2::uuid, path = $3, sort_order = $4 WHERE id = $1::uuid`,
		[item.id, targetParentId, newPath, sortOrder]
	);

	if (item.item_type === 'folder') {
		const subtree = await collectSubtree(client, item.id);
		for (const sub of subtree) {
			if (sub.id === item.id) continue;
			const subNewPath = replacePathPrefix(item.path, newPath, sub.path);
			await client.query(`UPDATE main_file SET path = $2 WHERE id = $1::uuid`, [
				sub.id,
				subNewPath
			]);
		}
	}
}

async function mergeFolderChildren(
	client: pg.PoolClient,
	sourceFolderId: string,
	targetFolderId: string,
	targetFolderPath: string,
	teamId: string
): Promise<number> {
	const children = await getChildren(client, sourceFolderId);
	let moved = 0;

	for (const child of children) {
		if (child.item_type === 'folder') {
			const existing = await findChildByName(client, targetFolderId, child.name, 'folder');
			if (existing) {
				console.log(`    merge folder "${child.name}" into existing ${existing.id}`);
				moved += await mergeFolderChildren(
					client,
					child.id,
					existing.id,
					existing.path,
					teamId
				);
				const remaining = await getChildren(client, child.id);
				if (remaining.length === 0) {
					console.log(`    remove empty folder "${child.name}" (${child.id})`);
					if (!dryRun) {
						await rm(child.path, { recursive: true, force: true });
						await client.query(`DELETE FROM main_file WHERE id = $1::uuid`, [child.id]);
					}
				}
				continue;
			}
		}

		await moveItemToParent(client, child, targetFolderId, targetFolderPath, teamId);
		moved += 1;
	}

	return moved;
}

async function removeEmptyFolder(client: pg.PoolClient, folder: MainFileRow): Promise<void> {
	const children = await getChildren(client, folder.id);
	if (children.length > 0) return;
	console.log(`  remove empty orphan portal folder (${folder.id})`);
	if (dryRun) return;
	await rm(folder.path, { recursive: true, force: true });
	await client.query(`DELETE FROM main_file WHERE id = $1::uuid`, [folder.id]);
}

async function migrateTeam(client: pg.PoolClient, team: TeamRow): Promise<void> {
	if (team.storage_provider !== 'local') {
		console.log(`Skip team "${team.name}" (${team.id}): storage_provider=${team.storage_provider}`);
		return;
	}
	if (!team.root_folder_id) {
		console.log(`Skip team "${team.name}" (${team.id}): no root_folder_id`);
		return;
	}

	const { rows: portalFolders } = await client.query<MainFileRow>(
		`SELECT id, name, item_type::text AS item_type, parent_id, path, team_id, owner_id,
		        storage_provider::text AS storage_provider, sort_order
		 FROM main_file
		 WHERE team_id = $1::uuid
		   AND name = $2
		   AND item_type = 'folder'
		   AND storage_provider = 'local'::master_storage_provider
		   AND trashed_at IS NULL`,
		[team.id, PORTAL_FOLDER_NAME]
	);

	if (portalFolders.length === 0) {
		console.log(`Team "${team.name}": no portal folder`);
		return;
	}

	const canonical = portalFolders.find((f) => f.parent_id === team.root_folder_id) ?? null;
	const orphans = portalFolders.filter((f) => f.parent_id !== team.root_folder_id);

	console.log(
		`Team "${team.name}" (${team.id}): ${portalFolders.length} portal folder(s), ` +
			`${orphans.length} orphan(s), canonical=${canonical?.id ?? 'none'}`
	);

	if (orphans.length === 0) {
		console.log('  nothing to migrate');
		return;
	}

	const { rows: rootRows } = await client.query<{ path: string }>(
		`SELECT path FROM main_file WHERE id = $1::uuid`,
		[team.root_folder_id]
	);
	const rootPath = rootRows[0]?.path;
	if (!rootPath) {
		console.error(`  team root path missing for ${team.root_folder_id}`);
		return;
	}

	let totalMoved = 0;
	let activeCanonical = canonical;

	for (const orphan of orphans) {
		if (!activeCanonical) {
			console.log(`  move orphan portal (${orphan.id}) under team root`);
			await moveItemToParent(client, orphan, team.root_folder_id, rootPath, team.id);
			activeCanonical = { ...orphan, parent_id: team.root_folder_id };
			if (!dryRun) {
				const { rows: updated } = await client.query<{ path: string }>(
					`SELECT path FROM main_file WHERE id = $1::uuid`,
					[orphan.id]
				);
				if (updated[0]) activeCanonical = { ...activeCanonical, path: updated[0].path };
			}
			totalMoved += 1;
			continue;
		}

		console.log(
			`  merge orphan portal (${orphan.id}) into canonical (${activeCanonical.id})`
		);
		totalMoved += await mergeFolderChildren(
			client,
			orphan.id,
			activeCanonical.id,
			activeCanonical.path,
			team.id
		);
		await removeEmptyFolder(client, orphan);
	}

	console.log(`  done: ${totalMoved} item(s) moved/merged`);
}

async function main() {
	const client = await pool.connect();
	try {
		const { rows: teams } = await client.query<TeamRow>(
			`SELECT id, name, root_folder_id, created_by_user_id, storage_provider::text AS storage_provider
			 FROM team
			 ORDER BY name`
		);

		console.log(`${dryRun ? '[DRY RUN] ' : ''}Migrating portal folders for ${teams.length} team(s)…`);

		for (const team of teams) {
			await migrateTeam(client, team);
		}

		console.log(dryRun ? 'Dry run complete.' : 'Migration complete.');
	} finally {
		client.release();
	}
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await pool.end();
	});
