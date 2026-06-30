import { fetchWithSession } from '$lib/client/fetch-session';
import { resolveHref } from '$lib/url/resolve-href';
import { copyPublicLinkFromButton } from '$lib/client/copy-public-link';
import {
	downloadDriveFileAsBlob,
	patchDriveFile,
	shareDriveFile,
	type PatchDriveFileBody
} from '$lib/client/drive-file';
import { bumpDriveListRefresh } from '$lib/state/drive-refresh.svelte';
import { toastService } from '$lib/service/toast.service.svelte';
import { StatusColorEnum } from '$lib/model/enum/color.enum';
import type { FileLabelColorId } from '$lib/model/file-label-color';
import type { DriveItem } from '$lib/components/drive/drive-item';
import { computeMenuPlacement } from '$lib/components/drive/drive-menu-placement';
import { tick } from 'svelte';

export type PublicLinkMeta =
	| { loading: true; public?: boolean }
	| { loading?: false; public: false }
	| {
			loading?: false;
			public: true;
			token: string;
			shareUrl: string;
			fileDirectUrl?: string;
	  };

type DriveFileActionsOptions = {
	menuElementId: string;
	buttonIdPrefix: string;
	getRows: () => DriveItem[];
	canEditItem?: (item: DriveItem) => boolean;
	onMenuOpen?: () => void;
};

export function createDriveFileActions(options: DriveFileActionsOptions) {
	let busyId = $state<string | null>(null);
	let renameDialogEl = $state<HTMLDialogElement | null>(null);
	let renameTarget = $state<DriveItem | null>(null);
	let draftName = $state('');

	let colorDialogEl = $state<HTMLDialogElement | null>(null);
	let colorTarget = $state<DriveItem | null>(null);

	let shareDialogEl = $state<HTMLDialogElement | null>(null);
	let shareTarget = $state<DriveItem | null>(null);
	let shareEmailDraft = $state('');
	let shareSubmitting = $state(false);

	let copyPublicLinkDialogEl = $state<HTMLDialogElement | null>(null);
	let copyPublicLinkDialog = $state<{
		name: string;
		shareUrl: string;
		fileDirectUrl?: string;
	} | null>(null);

	let openFileActionsId = $state<string | null>(null);
	let fileActionsMenuPosition = $state<{ top: number; left: number } | null>(null);
	let publicLinkMeta = $state<Record<string, PublicLinkMeta>>({});
	let publicLinkSectionOpen = $state(false);

	function canEdit(item: DriveItem): boolean {
		return options.canEditItem?.(item) ?? true;
	}

	function closeFileActionsMenu() {
		openFileActionsId = null;
		fileActionsMenuPosition = null;
		publicLinkSectionOpen = false;
	}

	async function refreshPublicLinkMeta(itemId: string) {
		publicLinkMeta = { ...publicLinkMeta, [itemId]: { loading: true } };
		try {
			const r = await fetchWithSession(resolveHref(`/api/drive/files/${itemId}/public-link`));
			if (!r.ok) throw new Error((await r.text()) || r.statusText);
			const j = (await r.json()) as
				| { public: false }
				| { public: true; token: string; shareUrl: string; fileDirectUrl?: string };
			if (!j.public) {
				publicLinkMeta = { ...publicLinkMeta, [itemId]: { public: false } };
			} else {
				publicLinkMeta = { ...publicLinkMeta, [itemId]: { ...j, loading: false } };
			}
		} catch {
			publicLinkMeta = { ...publicLinkMeta, [itemId]: { public: false } };
		}
	}

	async function onPublicLinkToggle(item: DriveItem, makePublic: boolean) {
		if (busyId === item.id) return;
		busyId = item.id;
		try {
			if (makePublic) {
				const r = await fetchWithSession(resolveHref(`/api/drive/files/${item.id}/public-link`), {
					method: 'POST'
				});
				if (!r.ok) throw new Error((await r.text()) || 'Failed to enable public link');
				toastService.addToast('Anyone with the link can view this file', StatusColorEnum.SUCCESS);
			} else {
				const r = await fetchWithSession(resolveHref(`/api/drive/files/${item.id}/public-link`), {
					method: 'DELETE'
				});
				if (!r.ok) throw new Error((await r.text()) || 'Failed to disable public link');
				toastService.addToast('Public link off', StatusColorEnum.INFO);
			}
			await refreshPublicLinkMeta(item.id);
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Public link update failed',
				StatusColorEnum.ERROR
			);
			await refreshPublicLinkMeta(item.id);
		} finally {
			busyId = null;
		}
	}

	function openCopyPublicLinkDialog(itemId: string) {
		const meta = publicLinkMeta[itemId];
		if (meta?.loading === true) {
			toastService.addToast('Still loading link…', StatusColorEnum.WARNING);
			return;
		}
		if (!meta || meta.public !== true || !('shareUrl' in meta)) {
			toastService.addToast('Turn on public link first', StatusColorEnum.WARNING);
			return;
		}
		const item = options.getRows().find((r) => r.id === itemId);
		closeFileActionsMenu();
		copyPublicLinkDialog = {
			name: item?.name ?? 'File',
			shareUrl: meta.shareUrl,
			fileDirectUrl: meta.fileDirectUrl
		};
		queueMicrotask(() => copyPublicLinkDialogEl?.showModal());
	}

	function closeCopyPublicLinkDialog() {
		copyPublicLinkDialog = null;
	}

	function copyDialogSharePageUrl(event: MouseEvent) {
		copyPublicLinkFromButton(event.currentTarget as HTMLButtonElement, 'Share page link copied');
	}

	function copyDialogDirectFileUrl(event: MouseEvent) {
		copyPublicLinkFromButton(event.currentTarget as HTMLButtonElement, 'Direct file link copied');
	}

	async function toggleFileActionsMenu(itemId: string, btn: HTMLButtonElement) {
		if (busyId === itemId) return;
		if (openFileActionsId === itemId) {
			closeFileActionsMenu();
			return;
		}
		openFileActionsId = itemId;
		publicLinkSectionOpen = false;
		fileActionsMenuPosition = computeMenuPlacement(btn, 320, 280);
		await tick();
		const menuEl = document.getElementById(options.menuElementId);
		if (menuEl) {
			fileActionsMenuPosition = computeMenuPlacement(btn, menuEl.offsetWidth, menuEl.offsetHeight);
		}
		options.onMenuOpen?.();
	}

	async function openPublicLinkSection(itemId: string) {
		publicLinkSectionOpen = true;
		if (!publicLinkMeta[itemId]) {
			await refreshPublicLinkMeta(itemId);
		}
	}

	function onDocumentEscape(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		closeFileActionsMenu();
	}

	function onDocumentPointerDownCloseMenu(e: PointerEvent) {
		const menu = document.getElementById(options.menuElementId);
		if (!menu) return;
		const t = e.target;
		if (!t || !(t instanceof Node)) return;
		if (menu.contains(t)) return;
		const openFor = menu.getAttribute('data-open-for');
		if (!openFor) return;
		const trigger = document.getElementById(`${options.buttonIdPrefix}${openFor}`);
		if (trigger?.contains(t)) return;
		closeFileActionsMenu();
	}

	function attachMenuListeners() {
		const onResize = () => closeFileActionsMenu();
		window.addEventListener('resize', onResize);
		document.addEventListener('keydown', onDocumentEscape, true);
		document.addEventListener('pointerdown', onDocumentPointerDownCloseMenu, true);
		return () => {
			window.removeEventListener('resize', onResize);
			document.removeEventListener('keydown', onDocumentEscape, true);
			document.removeEventListener('pointerdown', onDocumentPointerDownCloseMenu, true);
		};
	}

	async function runPatch(id: string, body: PatchDriveFileBody, successMsg?: string) {
		busyId = id;
		try {
			await patchDriveFile(id, body);
			bumpDriveListRefresh();
			if (successMsg) toastService.addToast(successMsg, StatusColorEnum.SUCCESS);
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Update failed',
				StatusColorEnum.ERROR
			);
		} finally {
			busyId = null;
		}
	}

	function openRename(item: DriveItem) {
		closeFileActionsMenu();
		renameTarget = item;
		draftName = item.name;
		queueMicrotask(() => renameDialogEl?.showModal());
	}

	function closeRename() {
		renameDialogEl?.close();
		renameTarget = null;
		draftName = '';
	}

	async function submitRename() {
		if (!renameTarget) return;
		const name = draftName.trim();
		if (!name) {
			toastService.addToast('Name cannot be empty', StatusColorEnum.WARNING);
			return;
		}
		await runPatch(renameTarget.id, { name }, 'Renamed');
		closeRename();
	}

	async function onTrash(item: DriveItem) {
		closeFileActionsMenu();
		if (!confirm(`Move “${item.name}” to trash?`)) return;
		await runPatch(item.id, { trashed: true }, 'Moved to trash');
	}

	function openColorModal(item: DriveItem) {
		closeFileActionsMenu();
		colorTarget = item;
		queueMicrotask(() => colorDialogEl?.showModal());
	}

	function openShareModal(item: DriveItem) {
		closeFileActionsMenu();
		shareTarget = item;
		shareEmailDraft = '';
		queueMicrotask(() => shareDialogEl?.showModal());
	}

	function closeShare() {
		shareDialogEl?.close();
		shareTarget = null;
		shareEmailDraft = '';
	}

	async function submitShare() {
		if (!shareTarget) return;
		const email = shareEmailDraft.trim().toLowerCase();
		if (!email) {
			toastService.addToast('Enter an email address', StatusColorEnum.WARNING);
			return;
		}
		shareSubmitting = true;
		try {
			const res = await shareDriveFile(shareTarget.id, { targetEmail: email, permission: 'read' });
			toastService.addToast(
				res.alreadyShared ? 'Already shared with that address' : 'Share created',
				StatusColorEnum.SUCCESS
			);
			closeShare();
		} catch (e) {
			toastService.addToast(e instanceof Error ? e.message : 'Share failed', StatusColorEnum.ERROR);
		} finally {
			shareSubmitting = false;
		}
	}

	async function onDownloadFile(item: DriveItem) {
		closeFileActionsMenu();
		try {
			const fallback = item.itemType === 'folder' ? `${item.name}.zip` : item.name;
			await downloadDriveFileAsBlob(item.id, fallback);
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Download failed',
				StatusColorEnum.ERROR
			);
		}
	}

	async function pickColor(c: FileLabelColorId) {
		if (!colorTarget) return;
		await runPatch(colorTarget.id, { color: c }, 'Color updated');
		colorDialogEl?.close();
	}

	async function clearItemColor() {
		if (!colorTarget) return;
		await runPatch(colorTarget.id, { color: null }, 'Color cleared');
		colorDialogEl?.close();
	}

	const fileActionsMenuItem = $derived(
		openFileActionsId ? (options.getRows().find((r) => r.id === openFileActionsId) ?? null) : null
	);

	return {
		get busyId() {
			return busyId;
		},
		get renameDialogEl() {
			return renameDialogEl;
		},
		set renameDialogEl(v) {
			renameDialogEl = v;
		},
		get renameTarget() {
			return renameTarget;
		},
		get draftName() {
			return draftName;
		},
		set draftName(v) {
			draftName = v;
		},
		get colorDialogEl() {
			return colorDialogEl;
		},
		set colorDialogEl(v) {
			colorDialogEl = v;
		},
		get colorTarget() {
			return colorTarget;
		},
		set colorTarget(v) {
			colorTarget = v;
		},
		get shareDialogEl() {
			return shareDialogEl;
		},
		set shareDialogEl(v) {
			shareDialogEl = v;
		},
		get shareTarget() {
			return shareTarget;
		},
		get shareEmailDraft() {
			return shareEmailDraft;
		},
		set shareEmailDraft(v) {
			shareEmailDraft = v;
		},
		get shareSubmitting() {
			return shareSubmitting;
		},
		get copyPublicLinkDialogEl() {
			return copyPublicLinkDialogEl;
		},
		set copyPublicLinkDialogEl(v) {
			copyPublicLinkDialogEl = v;
		},
		get copyPublicLinkDialog() {
			return copyPublicLinkDialog;
		},
		get openFileActionsId() {
			return openFileActionsId;
		},
		get fileActionsMenuPosition() {
			return fileActionsMenuPosition;
		},
		get publicLinkMeta() {
			return publicLinkMeta;
		},
		get publicLinkSectionOpen() {
			return publicLinkSectionOpen;
		},
		get fileActionsMenuItem() {
			return fileActionsMenuItem;
		},
		canEdit,
		closeFileActionsMenu,
		toggleFileActionsMenu,
		openPublicLinkSection,
		onPublicLinkToggle,
		openCopyPublicLinkDialog,
		closeCopyPublicLinkDialog,
		copyDialogSharePageUrl,
		copyDialogDirectFileUrl,
		attachMenuListeners,
		runPatch,
		openRename,
		closeRename,
		submitRename,
		onTrash,
		openColorModal,
		openShareModal,
		closeShare,
		submitShare,
		onDownloadFile,
		pickColor,
		clearItemColor
	};
}
