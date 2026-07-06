import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

/** Build-time placeholder when DATABASE_URL is unset (Docker image build). */
const PLACEHOLDER_DATABASE_URL = 'postgresql://build:build@placeholder.invalid/postgres';

const databaseUrl =
	(typeof env.DATABASE_URL === 'string' && env.DATABASE_URL.trim()
		? env.DATABASE_URL.trim()
		: undefined) ??
	(typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.trim()
		? process.env.DATABASE_URL.trim()
		: undefined);

if (!databaseUrl) {
	console.warn(
		'DATABASE_URL is not set; database access will fail until it is configured (e.g. Fly secrets / .env).'
	);
}

const pool = new pg.Pool({
	connectionString: databaseUrl ?? PLACEHOLDER_DATABASE_URL,
	max: 10
});

export const db = drizzle(pool, { schema });
