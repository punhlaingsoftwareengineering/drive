import { env } from '$env/dynamic/private';
import { homedir, platform } from 'node:os';
import { normalize as normalizeWin32, posix, win32 } from 'node:path';

/** Default folder name under the user's Documents directory (native dev). */
export const LOCAL_DRIVE_DIR_NAME = 'drive';

function pathJoin(...segments: string[]): string {
	return platform() === 'win32' ? win32.join(...segments) : posix.join(...segments);
}

/** Strip trailing slashes for the active platform (POSIX paths keep `/` separators). */
function stripTrailingSep(p: string): string {
	if (p.startsWith('/') && platform() !== 'win32') return p.replace(/\/+$/, '');
	return p.replace(/[\\/]+$/, '');
}

function normalizeExpandedPath(p: string): string {
	// POSIX absolute paths (e.g. Docker /data/znl-drive) — same on every host OS.
	if (p.startsWith('/') && !p.startsWith('//')) return stripTrailingSep(p);
	if (platform() === 'win32') return stripTrailingSep(normalizeWin32(p));
	return stripTrailingSep(posix.normalize(p));
}

/** OS user Documents folder (Windows USERPROFILE\\Documents, else ~/Documents). */
export function defaultDocumentsDir(): string {
	if (platform() === 'win32') {
		const userProfile = process.env.USERPROFILE?.trim();
		if (userProfile) return pathJoin(userProfile, 'Documents');
	}
	return pathJoin(homedir(), 'Documents');
}

/** Default native storage root: `<Documents>/drive`. */
export function defaultLocalDriveDataRoot(): string {
	return pathJoin(defaultDocumentsDir(), LOCAL_DRIVE_DIR_NAME);
}

/** Expand `~`, `%USERPROFILE%`, and normalize separators for the current OS. */
export function expandLocalDrivePath(input: string): string {
	let expanded = input.trim();
	if (!expanded) return expanded;

	if (platform() === 'win32' && process.env.USERPROFILE) {
		expanded = expanded.replace(/%USERPROFILE%/gi, process.env.USERPROFILE);
	}

	if (expanded === '~') return homedir();
	if (expanded.startsWith('~/') || expanded.startsWith('~\\')) {
		return normalizeExpandedPath(pathJoin(homedir(), expanded.slice(2)));
	}

	return normalizeExpandedPath(expanded);
}

function readLocalDriveDataDir(): string {
	const fromEnv =
		(typeof env.LOCAL_DRIVE_DATA_DIR === 'string' && env.LOCAL_DRIVE_DATA_DIR.trim()
			? env.LOCAL_DRIVE_DATA_DIR.trim()
			: undefined) ??
		(typeof process.env.LOCAL_DRIVE_DATA_DIR === 'string' && process.env.LOCAL_DRIVE_DATA_DIR.trim()
			? process.env.LOCAL_DRIVE_DATA_DIR.trim()
			: undefined);

	if (fromEnv) return expandLocalDrivePath(fromEnv);
	return defaultLocalDriveDataRoot();
}

/** Base directory for local file storage (override with `LOCAL_DRIVE_DATA_DIR` in Docker/LAN). */
export function localDriveDataRoot(): string {
	return readLocalDriveDataDir();
}

/** Per-user directory under the local data root. */
export function localUserUploadDir(userId: string): string {
	return pathJoin(localDriveDataRoot(), userId);
}

/** Team files live under `<data-root>/teams/<teamId>/`. */
export function localTeamUploadDir(teamId: string): string {
	return pathJoin(localDriveDataRoot(), 'teams', teamId);
}
