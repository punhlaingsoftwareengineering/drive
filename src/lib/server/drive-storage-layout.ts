import { join } from 'node:path';

/** Tigris folder rows store `.../folder/<id>/.keep`; get the directory prefix for children. */
export function tigrisFolderPrefixFromStoredPath(storedFolderPath: string): string {
	const stripped = storedFolderPath.replace(/\/\.keep$/, '');
	return stripped.endsWith('/') ? stripped : `${stripped}/`;
}

export function localPathNewFileAtRoot(userDir: string, fileId: string, safeName: string): string {
	return join(userDir, `${fileId}-${safeName}`);
}

export function localPathNewFileInsideFolder(
	parentFolderAbsPath: string,
	fileId: string,
	safeName: string
): string {
	return join(parentFolderAbsPath, `${fileId}-${safeName}`);
}

export function localPathNewFolderAtRoot(userDir: string, folderId: string): string {
	return join(userDir, 'folder', folderId);
}

export function localPathNewSubfolder(parentFolderAbsPath: string, folderId: string): string {
	return join(parentFolderAbsPath, 'folder', folderId);
}

export function tigrisKeyNewFileAtRoot(userId: string, fileId: string, safeName: string): string {
	return `users/${userId}/${fileId}/${safeName}`;
}

export function tigrisKeyNewFileInsideFolder(
	parentFolderStoredPath: string,
	fileId: string,
	safeName: string
): string {
	return `${tigrisFolderPrefixFromStoredPath(parentFolderStoredPath)}${fileId}/${safeName}`;
}

export function tigrisKeyNewFolderAtRoot(userId: string, folderId: string): string {
	return `users/${userId}/folder/${folderId}/.keep`;
}

export function tigrisKeyNewSubfolder(parentFolderStoredPath: string, folderId: string): string {
	const p = tigrisFolderPrefixFromStoredPath(parentFolderStoredPath);
	return `${p}folder/${folderId}/.keep`;
}

// --- Team-scoped (paths under `teams/<teamId>/...`) ---

export function tigrisKeyNewFileAtRootTeam(
	teamId: string,
	fileId: string,
	safeName: string
): string {
	return `teams/${teamId}/${fileId}/${safeName}`;
}

export function tigrisKeyNewFileInsideFolderTeam(
	parentFolderStoredPath: string,
	fileId: string,
	safeName: string
): string {
	const p = tigrisFolderPrefixFromStoredPath(parentFolderStoredPath);
	return `${p}${fileId}/${safeName}`;
}

export function tigrisKeyNewFolderAtRootTeam(teamId: string, folderId: string): string {
	return `teams/${teamId}/folder/${folderId}/.keep`;
}

export function tigrisKeyNewSubfolderTeam(
	parentFolderStoredPath: string,
	folderId: string
): string {
	const p = tigrisFolderPrefixFromStoredPath(parentFolderStoredPath);
	return `${p}folder/${folderId}/.keep`;
}
