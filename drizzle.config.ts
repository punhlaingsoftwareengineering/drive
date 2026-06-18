import { defineConfig } from 'drizzle-kit';

/**
 * Env is not loaded here — use Deno’s env loader when invoking drizzle-kit, e.g.
 * `deno task db:push` (loads .env via `--env-file=.env`).
 * The SvelteKit app uses `$env/dynamic/private` / Vite’s env handling instead of dotenv.
 */
if (!process.env.DATABASE_URL) {
	throw new Error(
		'DATABASE_URL is not set. Use `deno task db:*` (loads .env via --env-file), or export DATABASE_URL.'
	);
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: { url: process.env.DATABASE_URL },
	verbose: true,
	strict: true
});
