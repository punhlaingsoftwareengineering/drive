import { describe, expect, it, vi, beforeEach } from 'vitest';
import { error } from '@sveltejs/kit';

/**
 * This suite is intentionally a "server queries" smoke/guard layer:
 * - Ensures every API `+server.ts` module can be imported in unit tests.
 * - Ensures protected routes fail fast with 401 when unauthenticated.
 *
 * We mock DB/storage dependencies to keep tests deterministic and fast.
 */

const dbChain = new Proxy(
	{},
	{
		get(_t, prop) {
			if (prop === 'then') return undefined; // don't look like a Promise
			// chainable methods return the same proxy
			return (..._args: unknown[]) => dbChain;
		}
	}
);

vi.mock('$lib/server/db', () => ({ db: dbChain }));

vi.mock('$lib/server/require-api-session', () => ({
	requireApiSession: vi.fn(async () => {
		throw error(401, 'Unauthorized');
	}),
	requireCookieApiSession: vi.fn(async () => {
		throw error(401, 'Unauthorized');
	})
}));

// Routes may touch these modules at import-time; keep them inert.
vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$env/dynamic/public', () => ({ env: {} }));

// Avoid external side effects during import.
vi.mock('$lib/server/mailer', () => ({ mailer: { sendMail: vi.fn() } }));
vi.mock('$lib/server/drive-upload-chunk-store', () => ({}));
vi.mock('$lib/server/drive-upload-persist', () => ({}));
vi.mock('$lib/server/drive-folder-zip', () => ({}));

type Handler = (event: any) => Promise<any>;

async function safeImport(path: string) {
	try {
		return await import(path);
	} catch (e) {
		// Make failures obvious with module path context
		throw new Error(`Failed importing ${path}: ${String((e as any)?.message ?? e)}`);
	}
}

function mkEvent(url: URL, extra: Partial<any> = {}) {
	return {
		request: new Request(url),
		url,
		params: {},
		locals: {},
		platform: {},
		...extra
	};
}

describe('all important server queries (API +server.ts)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it(
		'imports every API route module',
		async () => {
			// Import sequentially to reduce concurrent pressure and keep output deterministic.
			const paths = [
				'./auth/login/+server',
				'./auth/logout/+server',
				'./auth/social/+server',
				'./auth/signup/+server',
				'./auth/signup/send-otp/+server',
				'./auth/signup/verify-otp/+server',
				'./cron/purge-trash/+server',
				'./developer/api-keys/+server',
				'./developer/api-keys/[id]/+server',
				'./developer/mode/+server',
				'./drive/files/+server',
				'./drive/files/[id]/+server',
				'./drive/files/[id]/download/+server',
				'./drive/files/[id]/public-link/+server',
				'./drive/files/[id]/share/+server',
				'./drive/folders/+server',
				'./drive/recent/+server',
				'./drive/shared/+server',
				'./drive/stats/+server',
				'./drive/trash/+server',
				'./drive/upload/+server',
				'./drive/upload/chunk/+server',
				'./public/files/[token]/+server',
				'./public/share/[token]/+server',
				'./teams/+server',
				'./teams/[teamId]/invites/+server'
			];

			const modules = [];
			for (const p of paths) modules.push(await safeImport(p));

			// sanity: at least one handler exists in each module
			for (const m of modules) {
				const hasHandler = Object.keys(m).some((k) =>
					['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(k)
				);
				expect(hasHandler).toBe(true);
			}
		},
		20000
	);

	it('protected drive routes fail fast with 401 when unauthenticated', async () => {
		const protectedRoutes: Array<{ mod: string; method: string; event: any }> = [
			{
				mod: './drive/files/+server',
				method: 'GET',
				event: mkEvent(new URL('http://localhost/api/drive/files?storageProvider=local'))
			},
			{
				mod: './drive/trash/+server',
				method: 'GET',
				event: mkEvent(new URL('http://localhost/api/drive/trash?storageProvider=local'))
			},
			{
				mod: './drive/shared/+server',
				method: 'GET',
				event: mkEvent(new URL('http://localhost/api/drive/shared?storageProvider=local'))
			},
			{
				mod: './drive/recent/+server',
				method: 'GET',
				event: mkEvent(new URL('http://localhost/api/drive/recent?storageProvider=local'))
			},
			{
				mod: './drive/stats/+server',
				method: 'GET',
				event: mkEvent(new URL('http://localhost/api/drive/stats?storageProvider=local'))
			},
			{
				mod: './teams/+server',
				method: 'GET',
				event: mkEvent(new URL('http://localhost/api/teams'))
			}
		];

		for (const r of protectedRoutes) {
			const m = await safeImport(r.mod);
			const fn = m[r.method] as Handler | undefined;
			expect(typeof fn).toBe('function');
			await expect(fn!(r.event)).rejects.toMatchObject({ status: 401 });
		}
	});
});

