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
		vi.stubEnv('NODE_ENV', 'development');
		vi.stubEnv('ORIGIN', 'http://drive.local.test');
		vi.stubEnv('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/drive');
		vi.stubEnv('LOCAL_DRIVE_DATA_DIR', '');
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
		vi.stubEnv('ORIGIN', 'https://drive.phh.com');
		vi.stubEnv('DATABASE_URL', 'postgres://postgres:x@172.16.0.67:5432/db_office_drive');
		const { localDriveDataRoot, localUserUploadDir } = await loadLocalDrivePath({
			homedir: () => '/home/testuser',
			platform: () => 'linux'
		});
		expect(localDriveDataRoot()).toBe('/data/znl-drive');
		expect(localUserUploadDir('u_1')).toBe('/data/znl-drive/u_1');
	});

	it('refuses Documents default when DATABASE_URL is remote', async () => {
		vi.stubEnv('NODE_ENV', 'development');
		vi.stubEnv('ORIGIN', 'http://drive.local.test');
		vi.stubEnv('DATABASE_URL', 'postgres://postgres:x@172.16.0.67:5432/db_office_drive');
		vi.stubEnv('LOCAL_DRIVE_DATA_DIR', '');
		const { localDriveDataRoot, LocalDriveConfigError } = await loadLocalDrivePath({
			homedir: () => '/home/testuser',
			platform: () => 'linux'
		});
		expect(() => localDriveDataRoot()).toThrow(LocalDriveConfigError);
	});

	it('refuses home-based LOCAL_DRIVE_DATA_DIR with production ORIGIN', async () => {
		vi.stubEnv('ORIGIN', 'https://drive.phh.com');
		vi.stubEnv('DATABASE_URL', 'postgres://postgres:x@host.docker.internal:5432/db');
		vi.stubEnv('LOCAL_DRIVE_DATA_DIR', '/home/testuser/Documents/drive');
		const { localDriveDataRoot, LocalDriveConfigError } = await loadLocalDrivePath({
			homedir: () => '/home/testuser',
			platform: () => 'linux'
		});
		expect(() => localDriveDataRoot()).toThrow(LocalDriveConfigError);
	});

	it('rejects writes outside data root', async () => {
		vi.stubEnv('LOCAL_DRIVE_DATA_DIR', '/data/znl-drive');
		vi.stubEnv('ORIGIN', 'https://drive.phh.com');
		const { assertLocalDiskPathInDataRoot, LocalDriveConfigError } = await loadLocalDrivePath({
			homedir: () => '/home/testuser',
			platform: () => 'linux'
		});
		expect(() =>
			assertLocalDiskPathInDataRoot(
				'C:\\Users\\zarnihlawn\\Documents\\drive\\teams\\x\\file.pdf'
			)
		).toThrow(LocalDriveConfigError);
		expect(() =>
			assertLocalDiskPathInDataRoot('/data/znl-drive/teams/x/file.pdf')
		).not.toThrow();
	});

	it('remaps legacy Windows team paths onto /data/znl-drive', async () => {
		vi.stubEnv('LOCAL_DRIVE_DATA_DIR', '/data/znl-drive');
		vi.stubEnv('ORIGIN', 'https://drive.phh.com');
		const { ensureLocalDiskPathInDataRoot, remapLegacyLocalPathToDataRoot } =
			await loadLocalDrivePath({
				homedir: () => '/home/testuser',
				platform: () => 'linux'
			});
		const legacy =
			'C:\\Users\\zarnihlawn\\Documents\\drive\\teams\\523af0f4-0ee2-4d8d-b723-c6682c4dad79\\folder\\53dc94f2-82db-4e77-a32b-1add8bece631';
		expect(remapLegacyLocalPathToDataRoot(legacy)).toBe(
			'/data/znl-drive/teams/523af0f4-0ee2-4d8d-b723-c6682c4dad79/folder/53dc94f2-82db-4e77-a32b-1add8bece631'
		);
		expect(ensureLocalDiskPathInDataRoot(legacy)).toBe(
			'/data/znl-drive/teams/523af0f4-0ee2-4d8d-b723-c6682c4dad79/folder/53dc94f2-82db-4e77-a32b-1add8bece631'
		);
	});
});

describe('local-drive-path (win32)', () => {
	it('uses USERPROFILE\\Documents\\drive by default for local.dev', async () => {
		vi.stubEnv('USERPROFILE', 'C:\\Users\\alice');
		vi.stubEnv('NODE_ENV', 'development');
		vi.stubEnv('ORIGIN', 'http://drive.local.test');
		vi.stubEnv('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/drive');
		vi.stubEnv('LOCAL_DRIVE_DATA_DIR', '');
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
