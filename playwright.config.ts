import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'deno task build && deno task preview', port: 1025 },
	testMatch: '**/*.e2e.{ts,js}'
});
