/**
 * One-time migration: merge PHH-DRIVE auth_user rows into shared portal `user` table
 * and rewrite drive app FKs to portal user IDs (matched by email).
 *
 * Usage (from drive repo):
 *   AUTH_DATABASE_URL=postgres://.../employee_portal \
 *   DATABASE_URL=postgres://.../db_drive \
 *   npx tsx scripts/merge-auth-users.ts
 *
 * Dry run:
 *   DRY_RUN=1 npx tsx scripts/merge-auth-users.ts
 */
import pg from 'pg';

const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

const authUrl = process.env.AUTH_DATABASE_URL?.trim() || process.env.PORTAL_DATABASE_URL?.trim();
const driveUrl = process.env.DATABASE_URL?.trim();

if (!authUrl || !driveUrl) {
	console.error('Set AUTH_DATABASE_URL (portal DB) and DATABASE_URL (drive DB).');
	process.exit(1);
}

const authPool = new pg.Pool({ connectionString: authUrl });
const drivePool = new pg.Pool({ connectionString: driveUrl });

type DriveUser = {
	id: string;
	email: string;
	name: string;
	email_verified: boolean;
	image: string | null;
	developer_mode_enabled: boolean;
};

type PortalUser = {
	id: string;
	email: string;
};

async function tableExists(pool: pg.Pool, table: string): Promise<boolean> {
	const res = await pool.query(
		`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
		[table]
	);
	return res.rowCount !== null && res.rowCount > 0;
}

async function main() {
	const hasDriveAuth = await tableExists(drivePool, 'auth_user');
	if (!hasDriveAuth) {
		console.log('No auth_user table in drive DB — nothing to migrate.');
		return;
	}

	const { rows: driveUsers } = await drivePool.query<DriveUser>(
		`SELECT id, email, name, email_verified, image, developer_mode_enabled FROM auth_user`
	);
	const { rows: portalUsers } = await authPool.query<PortalUser>(`SELECT id, email FROM "user"`);

	const portalByEmail = new Map(portalUsers.map((u) => [u.email.toLowerCase(), u.id]));
	const idMap = new Map<string, string>();

	for (const du of driveUsers) {
		const portalId = portalByEmail.get(du.email.toLowerCase());
		if (portalId) {
			if (portalId !== du.id) idMap.set(du.id, portalId);
			continue;
		}
		// Drive-only user: insert into shared auth with same ID
		console.log(`Insert portal user (drive-only): ${du.email} (${du.id})`);
		if (!dryRun) {
			await authPool.query(
				`INSERT INTO "user" (id, name, email, email_verified, image, developer_mode_enabled, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
				 ON CONFLICT (email) DO NOTHING`,
				[du.id, du.name, du.email, du.email_verified, du.image, du.developer_mode_enabled]
			);
			const { rows: accounts } = await drivePool.query(
				`SELECT * FROM auth_account WHERE user_id = $1`,
				[du.id]
			);
			for (const acc of accounts) {
				await authPool.query(
					`INSERT INTO account (id, account_id, provider_id, user_id, access_token, refresh_token, id_token,
					 access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at)
					 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
					 ON CONFLICT (id) DO NOTHING`,
					[
						acc.id,
						acc.account_id,
						acc.provider_id,
						acc.user_id,
						acc.access_token,
						acc.refresh_token,
						acc.id_token,
						acc.access_token_expires_at,
						acc.refresh_token_expires_at,
						acc.scope,
						acc.password
					]
				);
			}
		}
	}

	console.log(`Remapping ${idMap.size} drive user IDs to portal IDs`);
	for (const [oldId, newId] of idMap) {
		console.log(`  ${oldId} -> ${newId}`);
		if (dryRun) continue;
		await drivePool.query(`UPDATE main_file SET owner_id = $2 WHERE owner_id = $1`, [oldId, newId]);
		await drivePool.query(`UPDATE team_member SET user_id = $2 WHERE user_id = $1`, [oldId, newId]);
		await drivePool.query(`UPDATE team SET created_by_user_id = $2 WHERE created_by_user_id = $1`, [
			oldId,
			newId
		]);
		await drivePool.query(`UPDATE developer_api_key SET user_id = $2 WHERE user_id = $1`, [
			oldId,
			newId
		]);
		await drivePool.query(`UPDATE main_file_public_link SET owner_id = $2 WHERE owner_id = $1`, [
			oldId,
			newId
		]);
	}

	if (!dryRun) {
		console.log('Dropping legacy auth_* tables from drive DB…');
		await drivePool.query(`DROP TABLE IF EXISTS auth_session CASCADE`);
		await drivePool.query(`DROP TABLE IF EXISTS auth_account CASCADE`);
		await drivePool.query(`DROP TABLE IF EXISTS auth_verification CASCADE`);
		await drivePool.query(`DROP TABLE IF EXISTS auth_user CASCADE`);
	}

	console.log(dryRun ? 'Dry run complete.' : 'Migration complete.');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await authPool.end();
		await drivePool.end();
	});
