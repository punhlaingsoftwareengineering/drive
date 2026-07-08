import { paraglideVitePlugin } from '@inlang/paraglide-js';
import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type UserWorkspaceConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import { loadAppEnv, viteAllowedHosts } from './vite.allowed-hosts';

export default defineConfig(({ mode }) => {
	const env = loadAppEnv(mode);

	return {
	server: {
		allowedHosts: viteAllowedHosts(env)
	},
	plugins: [
		tailwindcss(),
		sveltekit(),
		devtoolsJson(),
		paraglideVitePlugin({ project: './project.inlang', outdir: './src/lib/paraglide' })
	],
	test: {
		expect: { requireAssertions: true },
		projects: (() => {
			// Default to server-only tests so `pnpm test:unit -- --run` works on machines
			// without Playwright browsers installed. Opt-in with: VITEST_BROWSER=1 pnpm test:unit
			const enableBrowser = process.env.VITEST_BROWSER === '1';
			return [
				...(enableBrowser
					? [
							{
								extends: './vite.config.ts',
								test: {
									name: 'client',
									browser: {
										enabled: true,
										// Chromium frequently fails to boot on Linux in sandboxed/CI-like
										// environments without these flags; failure manifests as
										// "Failed to connect to the browser session ... within the timeout".
										provider: playwright({
											launchOptions: {
												args: ['--no-sandbox', '--disable-dev-shm-usage']
											}
										}),
										instances: [{ browser: 'chromium' as const, headless: true }]
									},
									include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
									exclude: ['src/lib/server/**']
								}
							}
						]
					: []),
				{
					extends: './vite.config.ts',
					test: {
						name: 'server',
						environment: 'node',
						include: ['src/**/*.{test,spec}.{js,ts}'],
						exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
					}
				}
			];
		})() as UserWorkspaceConfig[]
	}
	};
});
