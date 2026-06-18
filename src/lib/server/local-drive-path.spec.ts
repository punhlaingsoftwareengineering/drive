import { describe, expect, it, vi } from 'vitest';

vi.mock('node:os', () => ({
	homedir: () => '/home/testuser'
}));

import { localDriveDataRoot, localTeamUploadDir, localUserUploadDir } from './local-drive-path';

describe('local-drive-path', () => {
	it('builds user upload directory under ~/Documents/znl-drive/<userId>', () => {
		expect(localUserUploadDir('u_123')).toBe('/home/testuser/Documents/znl-drive/u_123');
	});

	it('builds team upload directory under ~/Documents/znl-drive/teams/<teamId>', () => {
		expect(localTeamUploadDir('t_123')).toBe('/home/testuser/Documents/znl-drive/teams/t_123');
	});

	it('uses LOCAL_DRIVE_DATA_DIR when set', () => {
		vi.stubEnv('LOCAL_DRIVE_DATA_DIR', '/data/znl-drive');
		expect(localDriveDataRoot()).toBe('/data/znl-drive');
		expect(localUserUploadDir('u_1')).toBe('/data/znl-drive/u_1');
		vi.unstubAllEnvs();
	});
});
