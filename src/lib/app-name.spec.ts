import { afterEach, describe, expect, it, vi } from 'vitest';

describe('appName', () => {
	afterEach(() => {
		vi.resetModules();
		vi.unstubAllEnvs();
	});

	it('defaults when PUBLIC_APP_NAME is unset', async () => {
		vi.doMock('$env/dynamic/public', () => ({ env: {} }));
		const { appName, appTitle } = await import('./app-name');
		expect(appName()).toBe('ZNL-DRIVE');
		expect(appTitle('Auth', ' | ')).toBe('Auth | ZNL-DRIVE');
	});

	it('uses PUBLIC_APP_NAME when set', async () => {
		vi.doMock('$env/dynamic/public', () => ({ env: { PUBLIC_APP_NAME: 'Acme Drive' } }));
		const { appName } = await import('./app-name');
		expect(appName()).toBe('Acme Drive');
	});
});
