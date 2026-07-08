import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '$env/dynamic/private';
import {
	AuthAccountSchema,
	AuthSessionSchema,
	AuthUserSchema,
	AuthVerificationSchema
} from './schema/auth-schema/auth.schema';

const PLACEHOLDER_AUTH_DATABASE_URL = 'postgresql://build:build@placeholder.invalid/postgres';

function resolveAuthDatabaseUrl(): string {
	const fromEnv =
		(typeof env.AUTH_DATABASE_URL === 'string' && env.AUTH_DATABASE_URL.trim()
			? env.AUTH_DATABASE_URL.trim()
			: undefined) ??
		(typeof process.env.AUTH_DATABASE_URL === 'string' && process.env.AUTH_DATABASE_URL.trim()
			? process.env.AUTH_DATABASE_URL.trim()
			: undefined) ??
		(typeof env.DATABASE_URL === 'string' && env.DATABASE_URL.trim()
			? env.DATABASE_URL.trim()
			: undefined) ??
		(typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.trim()
			? process.env.DATABASE_URL.trim()
			: undefined);

	if (!fromEnv) {
		console.warn(
			'AUTH_DATABASE_URL is not set; falling back to placeholder (auth will fail until configured).'
		);
	}
	return fromEnv ?? PLACEHOLDER_AUTH_DATABASE_URL;
}

const authPool = new pg.Pool({
	connectionString: resolveAuthDatabaseUrl(),
	max: 10
});

const authSchema = {
	user: AuthUserSchema,
	session: AuthSessionSchema,
	account: AuthAccountSchema,
	verification: AuthVerificationSchema
};

export const authDb = drizzle(authPool, { schema: authSchema });
