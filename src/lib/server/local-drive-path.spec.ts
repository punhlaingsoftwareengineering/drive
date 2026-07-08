import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
	vi.doUnmock('node:os');
});

async function loadLocalDrivePath(osMock: {
	homedir: () => string;
	platform: () => NodeJS.Platform;
}) {
	vi.resetModules();
	vi.doMock('node:os', () => osMock);
	return import('./local-drive-path');
}

describe('local-drive-path (linux)', () => {
	it('builds paths under ~/Documents/drive', async () => {
		const { localUserUploadDir, localTeamUploadDir, defaultLocalDriveDataRoot } =
			await loadLocalDrivePath({
				homedir: () => '/home/testuser',
				platform: () => 'linux'
			});

		expect(defaultLocalDriveDataRoot()).toBe('/home/testuser/Documents/drive');
		expect(localUserUploadDir('u_123')).toBe('/home/testuser/Documents/drive/u_123');
		expect(localTeamUploadDir('t_123')).toBe('/home/testuser/Documents/drive/teams/t_123');
	});

	it('expands tilde-prefixed paths', async () => {
		const { expandLocalDrivePath } = await loadLocalDrivePath({
			homedir: () => '/home/testuser',
			platform: () => 'linux'
		});
		expect(expandLocalDrivePath('~/Documents/drive')).toBe('/home/testuser/Documents/drive');
	});

	it('uses LOCAL_DRIVE_DATA_DIR when set (POSIX path preserved)', async () => {
		vi.stubEnv('LOCAL_DRIVE_DATA_DIR', '/data/znl-drive');
		const { localDriveDataRoot, localUserUploadDir } = await loadLocalDrivePath({
			homedir: () => '/home/testuser',
			platform: () => 'linux'
		});
		expect(localDriveDataRoot()).toBe('/data/znl-drive');
		expect(localUserUploadDir('u_1')).toBe('/data/znl-drive/u_1');
	});
});

describe('local-drive-path (win32)', () => {
	it('uses USERPROFILE\\Documents\\drive by default', async () => {
		vi.stubEnv('USERPROFILE', 'C:\\Users\\alice');
		const { defaultDocumentsDir, defaultLocalDriveDataRoot, expandLocalDrivePath } =
			await loadLocalDrivePath({
				homedir: () => 'C:\\Users\\alice',
				platform: () => 'win32'
			});

		expect(defaultDocumentsDir()).toBe('C:\\Users\\alice\\Documents');
		expect(defaultLocalDriveDataRoot()).toBe('C:\\Users\\alice\\Documents\\drive');
		expect(expandLocalDrivePath('%USERPROFILE%/Documents/drive')).toBe(
			'C:\\Users\\alice\\Documents\\drive'
		);
		expect(expandLocalDrivePath('~/Documents/drive')).toBe('C:\\Users\\alice\\Documents\\drive');
	});
});
