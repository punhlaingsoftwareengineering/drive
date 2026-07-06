import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env' });

/**
 * Loads `.env` so `pnpm db:*` works without manually exporting `DATABASE_URL`.
 * The SvelteKit app uses `$env/dynamic/private` / Vite’s env handling at runtime.
 */
if (!process.env.DATABASE_URL) {
	throw new Error(
		'DATABASE_URL is not set. Add it to `.env` or export it before running drizzle-kit.'
	);
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: { url: process.env.DATABASE_URL },
	verbose: true,
	strict: true
});
