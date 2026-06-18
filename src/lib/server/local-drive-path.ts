import { env } from '$env/dynamic/private';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DIR_NAME = 'znl-drive';

function readLocalDriveDataDir(): string {
	const fromEnv =
		(typeof env.LOCAL_DRIVE_DATA_DIR === 'string' && env.LOCAL_DRIVE_DATA_DIR.trim()
			? env.LOCAL_DRIVE_DATA_DIR.trim()
			: undefined) ??
		(typeof process.env.LOCAL_DRIVE_DATA_DIR === 'string' && process.env.LOCAL_DRIVE_DATA_DIR.trim()
			? process.env.LOCAL_DRIVE_DATA_DIR.trim()
			: undefined);
	if (fromEnv) return fromEnv.replace(/\/$/, '');
	return join(homedir(), 'Documents', DIR_NAME);
}

/** Base directory for local file storage (override with `LOCAL_DRIVE_DATA_DIR` in Docker/LAN). */
export function localDriveDataRoot(): string {
	return readLocalDriveDataDir();
}

/** Per-user directory under the local data root. */
export function localUserUploadDir(userId: string): string {
	return join(localDriveDataRoot(), userId);
}

/** Team files live under `<data-root>/teams/<teamId>/`. */
export function localTeamUploadDir(teamId: string): string {
	return join(localDriveDataRoot(), 'teams', teamId);
}
