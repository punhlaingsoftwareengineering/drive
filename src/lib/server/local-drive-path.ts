import { env } from '$env/dynamic/private';
import { homedir, platform } from 'node:os';
import { normalize as normalizeWin32, posix, win32 } from 'node:path';

/** Default folder name under the user's Documents directory (native local.dev only). */
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

function readEnv(name: string): string {
	// Prefer process.env so Vitest stubs / Docker -e overrides win over bundled $env.
	if (Object.prototype.hasOwnProperty.call(process.env, name)) {
		return String(process.env[name] ?? '').trim();
	}
	const fromSvelte =
		typeof env[name] === 'string' && env[name].trim() ? env[name].trim() : undefined;
	return fromSvelte ?? '';
}

/** OS user Documents folder (Windows USERPROFILE\\Documents, else ~/Documents). */
export function defaultDocumentsDir(): string {
	if (platform() === 'win32') {
		const userProfile = process.env.USERPROFILE?.trim();
		if (userProfile) return pathJoin(userProfile, 'Documents');
	}
	return pathJoin(homedir(), 'Documents');
}

/** Default native storage root: `<Documents>/drive` (local.dev only). */
export function defaultLocalDriveDataRoot(): string {
	return pathJoin(defaultDocumentsDir(), LOCAL_DRIVE_DIR_NAME);
}

/** Expand `~`, `%USERPROFILE%`, and normalize separators for the current OS. */
export function expandLocalDrivePath(input: string): string {
	let expanded = input.trim();
	if (!expanded) return expanded;

	if (platform() === 'win32' && process.env.USERPROFILE) {
		expanded = expanded.replace(/%USERPROFILE%/gi, process.env.USERPROFILE);
		expanded = expanded.replace(/\//g, '\\');
	}

	if (expanded === '~') return homedir();
	if (expanded.startsWith('~/') || expanded.startsWith('~\\')) {
		return normalizeExpandedPath(pathJoin(homedir(), expanded.slice(2)));
	}

	return normalizeExpandedPath(expanded);
}

function originHostname(): string {
	const origin = readEnv('ORIGIN');
	if (!origin) return '';
	try {
		return new URL(origin).hostname.toLowerCase();
	} catch {
		return '';
	}
}

function databaseHostname(): string {
	const url = readEnv('DATABASE_URL');
	if (!url) return '';
	try {
		return new URL(url).hostname.toLowerCase();
	} catch {
		return '';
	}
}

const LOOPBACK_DB_HOSTS = new Set([
	'localhost',
	'127.0.0.1',
	'::1',
	'db',
	'postgres',
	'host.docker.internal'
]);

/**
 * True when this process should never fall back to ~/Documents/drive:
 * production ORIGIN (*.phh.com) or a non-local DATABASE_URL (e.g. 172.16.0.67).
 */
export function mustUseExplicitLocalDriveDir(): boolean {
	if (process.env.NODE_ENV === 'production') return true;

	const host = originHostname();
	if (host === 'drive.phh.com' || (host.endsWith('.phh.com') && !host.includes('local'))) {
		return true;
	}

	const dbHost = databaseHostname();
	if (dbHost && !LOOPBACK_DB_HOSTS.has(dbHost)) return true;

	return false;
}

function isUnderDirectory(candidate: string, root: string): boolean {
	const c = normalizeExpandedPath(candidate).toLowerCase();
	const r = normalizeExpandedPath(root).toLowerCase();
	if (c === r) return true;
	const sep = r.includes('\\') && !r.startsWith('/') ? '\\' : '/';
	const prefix = r.endsWith(sep) ? r : r + sep;
	return c.startsWith(prefix);
}

function looksLikeUserHomeStorage(root: string): boolean {
	const normalized = normalizeExpandedPath(root);
	const home = normalizeExpandedPath(homedir());
	if (home && isUnderDirectory(normalized, home)) return true;
	if (/^[a-z]:\\users\\/i.test(normalized)) return true;
	if (normalized.includes('/home/') && normalized.includes('/Documents/')) return true;
	return false;
}

export class LocalDriveConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LocalDriveConfigError';
	}
}

/**
 * Reject developer-machine storage when talking to shared/production backends.
 * Docker/production must set LOCAL_DRIVE_DATA_DIR=/data/znl-drive (or another /data/... path).
 */
export function assertLocalDriveRootAllowed(root: string): void {
	const normalized = normalizeExpandedPath(root);
	if (!normalized) {
		throw new LocalDriveConfigError('LOCAL_DRIVE_DATA_DIR resolved to an empty path');
	}

	if (!mustUseExplicitLocalDriveDir()) return;

	if (looksLikeUserHomeStorage(normalized)) {
		throw new LocalDriveConfigError(
			'Refusing to store Drive files under this machine\'s home/Documents folder while ' +
				'ORIGIN is a shared host (*.phh.com) or DATABASE_URL points at a remote database. ' +
				'Set LOCAL_DRIVE_DATA_DIR=/data/znl-drive on the server (or use a dedicated non-home path for intentional remote-DB testing).'
		);
	}

	const host = originHostname();
	if (
		(host === 'drive.phh.com' || host.endsWith('.phh.com')) &&
		!normalized.startsWith('/data/')
	) {
		throw new LocalDriveConfigError(
			`Production Drive ORIGIN (${host}) requires LOCAL_DRIVE_DATA_DIR under /data/ ` +
				`(got "${normalized}"). Use /data/znl-drive in the container.`
		);
	}
}

/** Ensure a local file/folder path stays inside the configured data root. */
export function assertLocalDiskPathInDataRoot(diskPath: string): void {
	const root = localDriveDataRoot();
	const normalized = normalizeExpandedPath(diskPath);
	if (!isUnderDirectory(normalized, root)) {
		throw new LocalDriveConfigError(
			`Refusing to write outside LOCAL_DRIVE_DATA_DIR ("${root}"). ` +
				`Path "${normalized}" looks like a legacy/local-machine location. ` +
				'Upload into a folder created on drive.phh.com, or recreate the parent folder on the server.'
		);
	}
}

/**
 * Remap Windows/Documents (or other off-root) paths onto LOCAL_DRIVE_DATA_DIR.
 * Keeps the `teams/<id>/...` (or trailing relative) suffix so folder trees stay intact.
 */
export function remapLegacyLocalPathToDataRoot(diskPath: string): string | null {
	const root = localDriveDataRoot();
	const asPosix = diskPath.replace(/\\/g, '/');
	const normalized = normalizeExpandedPath(diskPath);
	if (isUnderDirectory(normalized, root)) return normalized;

	const lower = asPosix.toLowerCase();
	const teamsIdx = lower.indexOf('/teams/');
	if (teamsIdx !== -1) {
		const relative = asPosix.slice(teamsIdx + 1); // teams/...
		return normalizeExpandedPath(posix.join(root, relative));
	}

	const driveTeamsIdx = lower.search(/(?:^|\/)drive\/teams\//);
	if (driveTeamsIdx !== -1) {
		const fromDrive = asPosix.slice(lower.indexOf('drive/teams/'));
		const relative = fromDrive.replace(/^drive\//i, '');
		return normalizeExpandedPath(posix.join(root, relative));
	}

	// Personal uploads: .../drive/<userId>/...
	const driveIdx = lower.search(/(?:^|\/)drive\/[^/]+\//);
	if (driveIdx !== -1) {
		const fromDrive = asPosix.slice(lower.indexOf('/drive/') >= 0 ? lower.indexOf('/drive/') + 1 : lower.indexOf('drive/'));
		const relative = fromDrive.replace(/^drive\//i, '');
		if (relative) return normalizeExpandedPath(posix.join(root, relative));
	}

	return null;
}

/** Return a path under the data root, remapping legacy locations when possible. */
export function ensureLocalDiskPathInDataRoot(diskPath: string): string {
	const remapped = remapLegacyLocalPathToDataRoot(diskPath);
	if (!remapped) {
		assertLocalDiskPathInDataRoot(diskPath);
		return normalizeExpandedPath(diskPath);
	}
	assertLocalDiskPathInDataRoot(remapped);
	return remapped;
}

function readLocalDriveDataDir(): string {
	const fromEnv = readEnv('LOCAL_DRIVE_DATA_DIR');

	if (fromEnv) {
		const expanded = expandLocalDrivePath(fromEnv);
		assertLocalDriveRootAllowed(expanded);
		return expanded;
	}

	if (mustUseExplicitLocalDriveDir()) {
		throw new LocalDriveConfigError(
			'LOCAL_DRIVE_DATA_DIR is required when ORIGIN is *.phh.com or DATABASE_URL is not local. ' +
				'Refusing to default to Documents on this machine. Docker: LOCAL_DRIVE_DATA_DIR=/data/znl-drive'
		);
	}

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
