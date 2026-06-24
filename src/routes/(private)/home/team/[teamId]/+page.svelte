<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { fetchWithSession } from '$lib/client/fetch-session';
	import { resolveHref } from '$lib/url/resolve-href';
	import { page } from '$app/state';
	import { copyPublicLinkFromButton } from '$lib/client/copy-public-link';
	import {
		downloadDriveFileAsBlob,
		patchDriveFile,
		shareDriveFile,
		type PatchDriveFileBody
	} from '$lib/client/drive-file';
	import { uploadFilesWithProgress } from '$lib/client/upload-drive';
	import {
		FILE_LABEL_COLORS,
		fileLabelBadgeClass,
		fileLabelBorderClass,
		fileLabelIconClass,
		type FileLabelColorId
	} from '$lib/model/file-label-color';
	import type { StorageProviderId } from '$lib/model/storage-provider';
	import { storageProviderLabel } from '$lib/model/storage-provider';
	import { StatusColorEnum } from '$lib/model/enum/color.enum';
	import {
		bumpDriveListRefresh,
		registerDriveListReload
	} from '$lib/state/drive-refresh.svelte';
	import { driveStorage } from '$lib/state/storage-provider.svelte';
	import { toastService } from '$lib/service/toast.service.svelte';
	import { formatBytes } from '$lib/tool/format-bytes';
	import type { PageProps } from './$types';
	import {
		LucideArrowLeft,
		LucideCopy,
		LucideDownload,
		LucideEllipsisVertical,
	import AppMarkIcon from '$lib/components/app-mark-icon.svelte';
		LucideFolder,
		LucideLink2,
		LucidePalette,
		LucidePencil,
		LucidePin,
		LucideShare2,
		LucideStar,
		LucideTrash2
	} from '@lucide/svelte';
	import { onMount, tick } from 'svelte';

	let { data }: PageProps = $props();

	type ApiFile = {
		id: string;
		name: string;
		itemType: string;
		sizeBytes: number;
		updatedAt: string;
		storageProvider: StorageProviderId;
		isPinned: boolean;
		isStarred: boolean;
		color: string | null;
		parentId: string | null;
		ownerName: string;
	};

	type DriveItem = {
		id: string;
		name: string;
		itemType: 'file' | 'folder';
		sizeBytes: number | null;
		updatedAt: string;
		storageProvider: StorageProviderId;
		pinned: boolean;
		starred: boolean;
		color: FileLabelColorId | string | null;
		parentId: string | null;
		ownerName: string;
	};

	let rows = $state<DriveItem[]>([]);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let fileDragDepth = $state(0);
	let dropUploading = $state(false);
	let dropProgress = $state(0);
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

	/** One floating menu (no Popover API — avoids ghost menus at 0,0 and stuck open state). */
	let openFileActionsId = $state<string | null>(null);
	let fileActionsMenuPosition = $state<{ top: number; left: number } | null>(null);

	type PublicLinkMeta =
		| { loading: true; public?: boolean }
		| { loading?: false; public: false }
		| {
				loading?: false;
				public: true;
				token: string;
				shareUrl: string;
				fileDirectUrl?: string;
		  };

	let publicLinkMeta = $state<Record<string, PublicLinkMeta>>({});

	function closeFileActionsMenu() {
		openFileActionsId = null;
		fileActionsMenuPosition = null;
	}

	async function refreshPublicLinkMeta(itemId: string) {
		publicLinkMeta = { ...publicLinkMeta, [itemId]: { loading: true } };
		try {
			const r = await fetchWithSession(resolveHref(`/api/drive/files/${itemId}/public-link`));
			if (!r.ok) throw new Error((await r.text()) || r.statusText);
			const j = (await r.json()) as
				| { public: false }
				| {
						public: true;
						token: string;
						shareUrl: string;
						fileDirectUrl?: string;
				  };
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

	function closeCopyPublicLinkDialog() {
		copyPublicLinkDialog = null;
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
		const item = rows.find((r) => r.id === itemId);
		closeFileActionsMenu();
		copyPublicLinkDialog = {
			name: item?.name ?? 'File',
			shareUrl: meta.shareUrl,
			fileDirectUrl: meta.fileDirectUrl
		};
		queueMicrotask(() => copyPublicLinkDialogEl?.showModal());
	}

	function copyDialogSharePageUrl(event: MouseEvent) {
		copyPublicLinkFromButton(event.currentTarget as HTMLButtonElement, 'Share page link copied');
	}

	function copyDialogDirectFileUrl(event: MouseEvent) {
		copyPublicLinkFromButton(event.currentTarget as HTMLButtonElement, 'Direct file link copied');
	}

	function computeMenuPlacement(btn: HTMLElement, menuWidth: number, menuHeight: number) {
		const rect = btn.getBoundingClientRect();
		const gap = 6;
		let left = rect.right - menuWidth;
		left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
		const spaceBelow = window.innerHeight - rect.bottom - gap;
		const spaceAbove = rect.top - gap;
		let top: number;
		if (menuHeight <= spaceBelow || spaceBelow >= spaceAbove) {
			top = rect.bottom + gap;
		} else {
			top = rect.top - menuHeight - gap;
		}
		top = Math.max(8, Math.min(top, window.innerHeight - menuHeight - 8));
		return { top, left };
	}

	async function toggleFileActionsMenu(itemId: string, btn: HTMLButtonElement) {
		if (busyId === itemId) return;
		if (openFileActionsId === itemId) {
			closeFileActionsMenu();
			return;
		}
		openFileActionsId = itemId;
		fileActionsMenuPosition = computeMenuPlacement(btn, 320, 280);
		await tick();
		const menuEl = document.getElementById('file-actions-menu-float');
		if (menuEl) {
			fileActionsMenuPosition = computeMenuPlacement(btn, menuEl.offsetWidth, menuEl.offsetHeight);
		}
		void refreshPublicLinkMeta(itemId);
	}

	function onDocumentEscape(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		closeFileActionsMenu();
	}

	function onDocumentPointerDownCloseMenu(e: PointerEvent) {
		const menu = document.getElementById('file-actions-menu-float');
		if (!menu) return;
		const t = e.target;
		if (!t || !(t instanceof Node)) return;
		if (menu.contains(t)) return;
		const openFor = menu.getAttribute('data-open-for');
		if (!openFor) return;
		const trigger = document.getElementById(`file-actions-btn-${openFor}`);
		if (trigger?.contains(t)) return;
		closeFileActionsMenu();
	}

	onMount(() => {
		void loadFiles();
		const unregister = registerDriveListReload(() => void loadFiles());

		const onResize = () => closeFileActionsMenu();
		window.addEventListener('resize', onResize);
		document.addEventListener('keydown', onDocumentEscape, true);
		document.addEventListener('pointerdown', onDocumentPointerDownCloseMenu, true);
		return () => {
			unregister();
			window.removeEventListener('resize', onResize);
			document.removeEventListener('keydown', onDocumentEscape, true);
			document.removeEventListener('pointerdown', onDocumentPointerDownCloseMenu, true);
		};
	});

	afterNavigate(() => {
		if (browser) void loadFiles();
	});

	function mapRow(f: ApiFile): DriveItem {
		return {
			id: f.id,
			name: f.name,
			itemType: f.itemType === 'folder' ? 'folder' : 'file',
			sizeBytes: f.sizeBytes,
			updatedAt: f.updatedAt.slice(0, 10),
			storageProvider: f.storageProvider,
			pinned: f.isPinned,
			starred: f.isStarred,
			color: f.color as FileLabelColorId | null,
			parentId: f.parentId ?? null,
			ownerName: f.ownerName
		};
	}

	const teamBase = $derived(
		data.teamView ? resolve(`/home/team/${data.teamView.id}`) : resolve('/home')
	);

	function enterFolder(item: DriveItem) {
		if (item.itemType !== 'folder') return;
		goto(`${teamBase}?folder=${encodeURIComponent(item.id)}`);
	}

	function teamStorage(): StorageProviderId {
		return data.teamView?.storageProvider ?? driveStorage.current;
	}

	function dropParentId(): string | null {
		if (!data.teamView) return null;
		return page.url.searchParams.get('folder') ?? data.teamView.rootFolderId;
	}

	async function loadFiles() {
		loading = true;
		loadError = null;
		try {
			if (!data.teamView) {
				rows = [];
				return;
			}
			const folderId = page.url.searchParams.get('folder');
			const qs = new URLSearchParams({
				storageProvider: teamStorage()
			});
			qs.set('teamId', data.teamView.id);
			if (folderId) qs.set('parentId', folderId);
			const r = await fetchWithSession(`${resolveHref('/api/drive/files')}?${qs}`);
			if (!r.ok) {
				const t = await r.text();
				throw new Error(t || r.statusText);
			}
			const payload = (await r.json()) as { files: ApiFile[] };
			rows = payload.files.map(mapRow);
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load files';
			rows = [];
		} finally {
			loading = false;
		}
	}

	const rootRows = $derived(rows.slice().sort((a, b) => a.name.localeCompare(b.name)));

	const pinnedRows = $derived(rootRows.filter((r) => r.pinned));
	const starredRows = $derived(rootRows.filter((r) => r.starred && !r.pinned));
	const otherRows = $derived(rootRows.filter((r) => !r.pinned && !r.starred));

	/** Parent folder URL from server (home root or parent folder). */
	const backFolderHref = $derived.by(() => {
		const cf = data.currentFolder;
		if (!cf) return teamBase;
		return cf.upHref;
	});

	const fileActionsMenuItem = $derived(
		openFileActionsId ? (rows.find((r) => r.id === openFileActionsId) ?? null) : null
	);

	function colorLabel(c: string): string {
		return c.charAt(0).toUpperCase() + c.slice(1);
	}

	async function runPatch(id: string, body: PatchDriveFileBody, successMsg?: string) {
		busyId = id;
		try {
			await patchDriveFile(id, body);
			bumpDriveListRefresh();
			if (successMsg) toastService.addToast(successMsg, StatusColorEnum.SUCCESS);
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Update failed';
			toastService.addToast(msg, StatusColorEnum.ERROR);
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

	async function uploadDroppedFiles(fileList: File[]) {
		if (!fileList.length) return;
		if (!data.teamView) return;
		dropUploading = true;
		dropProgress = 0;
		try {
			await uploadFilesWithProgress(
				fileList,
				teamStorage(),
				(loaded, total) => {
					dropProgress = total ? Math.round((100 * loaded) / total) : 0;
				},
				dropParentId(),
				data.teamView.id
			);
			bumpDriveListRefresh();
			toastService.addToast(`Uploaded ${fileList.length} file(s)`, StatusColorEnum.SUCCESS);
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Upload failed';
			toastService.addToast(msg, StatusColorEnum.ERROR);
		} finally {
			dropUploading = false;
			dropProgress = 0;
			fileDragDepth = 0;
		}
	}

	function onDropCard(e: DragEvent) {
		e.preventDefault();
		const dt = e.dataTransfer;
		if (!dt?.files?.length) return;
		void uploadDroppedFiles(Array.from(dt.files));
	}

	function onCardDragEnter(e: DragEvent) {
		if (e.dataTransfer?.types.includes('Files')) {
			e.preventDefault();
			fileDragDepth += 1;
		}
	}

	function onCardDragLeave(e: DragEvent) {
		if (e.dataTransfer?.types.includes('Files')) {
			fileDragDepth = Math.max(0, fileDragDepth - 1);
		}
	}
</script>

<div class="flex min-h-0 flex-1 flex-col gap-6 pb-8">
	<p class="shrink-0 text-sm text-base-content/70">
		Team drive — all members can add, edit, and delete here. Storage is fixed for this team (see
		header). Drag files onto the table to upload; use <strong>NEW</strong> for folders or upload.
	</p>

	{#if loading && rows.length === 0}
		<div class="h-40 w-full d-skeleton"></div>
	{:else if loadError}
		<div class="d-alert d-alert-error">
			<span>{loadError}</span>
		</div>
	{/if}

	{#if dropUploading}
		<div class="d-alert d-alert-info">
			<span>Uploading… {dropProgress}%</span>
			<progress class="d-progress mt-2 w-full d-progress-info" value={dropProgress} max="100"
			></progress>
		</div>
	{/if}

	<div
		class="d-card flex min-h-0 flex-1 flex-col border border-base-300 bg-base-100 shadow-sm transition-colors {fileDragDepth >
		0
			? 'border-info/50 bg-info/5'
			: ''}"
		role="region"
		aria-label="Files"
		ondragenter={onCardDragEnter}
		ondragleave={onCardDragLeave}
		ondragover={(e) => {
			if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
		}}
		ondrop={onDropCard}
	>
		<div class="d-card-body flex min-h-0 flex-1 flex-col p-0">
			<div class="min-h-0 flex-1 overflow-auto" onscroll={closeFileActionsMenu}>
				<table class="d-table w-full min-w-[52rem] d-table-zebra">
					<thead>
						<tr class="border-b border-base-300">
							<th class="min-w-[14rem]">Name</th>
							<th class="w-28">Size</th>
							<th class="w-36">Modified</th>
							<th class="w-32">Storage</th>
							<th class="min-w-[8rem]">Owner</th>
							<th class="w-24 text-center">Pin</th>
							<th class="w-24 text-center">Star</th>
							<th class="w-14 text-center"></th>
						</tr>
					</thead>
					<tbody>
						{#if pinnedRows.length > 0}
							<tr class="bg-base-200/60 hover:bg-base-200/60">
								<td
									colspan="8"
									class="py-2 text-xs font-semibold tracking-wide text-base-content/80 uppercase"
								>
									<span class="inline-flex items-center gap-2">
										<LucidePin class="size-3.5" aria-hidden="true" />
										Pinned
									</span>
								</td>
							</tr>
							{#each pinnedRows as item (item.id)}
								<tr
									class="border-l-4 transition-colors hover:bg-info/50 {fileLabelBorderClass(
										item.color
									)}"
								>
									{@render fileRowCells(item)}
								</tr>
							{/each}
						{/if}

						{#if starredRows.length > 0}
							<tr class="bg-base-200/60 hover:bg-base-200/60">
								<td
									colspan="8"
									class="py-2 text-xs font-semibold tracking-wide text-base-content/80 uppercase"
								>
									<span class="inline-flex items-center gap-2">
										<LucideStar class="size-3.5" aria-hidden="true" />
										Starred
									</span>
								</td>
							</tr>
							{#each starredRows as item (item.id)}
								<tr
									class="border-l-4 transition-colors hover:bg-info/50 {fileLabelBorderClass(
										item.color
									)}"
								>
									{@render fileRowCells(item)}
								</tr>
							{/each}
						{/if}

						<tr class="bg-base-200/60 hover:bg-base-200/60">
							<td colspan="8" class="py-2 text-xs font-semibold tracking-wide uppercase">
								{#if data.currentFolder}
									<a
										href={backFolderHref}
										class="inline-flex max-w-full min-w-0 items-center gap-2 text-base-content/80 normal-case no-underline hover:text-base-content hover:underline"
										aria-label="Back out of {data.currentFolder.name}"
									>
										<LucideArrowLeft class="size-3.5 shrink-0" aria-hidden="true" />
										<span class="truncate font-medium">{data.currentFolder.name}</span>
									</a>
								{:else}
									<span class="text-base-content/80">All files</span>
								{/if}
							</td>
						</tr>
						{#if rootRows.length === 0 && !loading}
							<tr>
								<td colspan="8" class="py-8 text-center text-base-content/60">
									No files for {storageProviderLabel(driveStorage.current)} yet. Use
									<strong>NEW</strong> or drag files here.
								</td>
							</tr>
						{:else}
							{#each otherRows as item (item.id)}
								<tr
									class="border-l-4 transition-colors hover:bg-info/50 {fileLabelBorderClass(
										item.color
									)}"
								>
									{@render fileRowCells(item)}
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>

{#if openFileActionsId && fileActionsMenuPosition && fileActionsMenuItem}
	<ul
		id="file-actions-menu-float"
		data-open-for={fileActionsMenuItem.id}
		role="menu"
		class="d-menu fixed z-[999] m-0 max-w-[90vw] min-w-[20rem] rounded-box border border-base-200 bg-base-100 p-2 shadow-md"
		style="top: {fileActionsMenuPosition.top}px; left: {fileActionsMenuPosition.left}px;"
	>
		{#if fileActionsMenuItem.itemType === 'file' || fileActionsMenuItem.itemType === 'folder'}
			<li role="none">
				<button
					type="button"
					role="menuitem"
					class="justify-start gap-2"
					onclick={() => void onDownloadFile(fileActionsMenuItem)}
				>
					<LucideDownload class="size-4 shrink-0" aria-hidden="true" />
					{fileActionsMenuItem.itemType === 'folder' ? 'Download as ZIP' : 'Download'}
				</button>
			</li>
		{/if}
		{#if fileActionsMenuItem.itemType === 'file' || fileActionsMenuItem.itemType === 'folder'}
			<li role="none">
				<button
					type="button"
					role="menuitem"
					class="justify-start gap-2"
					onclick={() => openShareModal(fileActionsMenuItem)}
				>
					<LucideShare2 class="size-4 shrink-0" aria-hidden="true" />
					Share…
				</button>
			</li>
		{/if}
		{#key fileActionsMenuItem.id}
			{@const meta = publicLinkMeta[fileActionsMenuItem.id]}
			<li role="none">
				<button
					type="button"
					role="menuitem"
					class="justify-start gap-2"
					disabled={busyId === fileActionsMenuItem.id || meta?.loading === true}
					onclick={() => void onPublicLinkToggle(fileActionsMenuItem, meta?.public !== true)}
				>
					<LucideLink2 class="size-4 shrink-0" aria-hidden="true" />
					{meta?.public === true ? 'Make private' : 'Make public'}
				</button>
			</li>
			<li role="none">
				<button
					type="button"
					role="menuitem"
					class="justify-start gap-2"
					disabled={busyId === fileActionsMenuItem.id ||
						meta?.loading === true ||
						meta?.public !== true}
					onclick={() => openCopyPublicLinkDialog(fileActionsMenuItem.id)}
				>
					<LucideCopy class="size-4 shrink-0" aria-hidden="true" />
					Copy link
				</button>
			</li>
			{#if meta?.loading}
				<li role="none">
					<div class="px-2 py-1 text-xs text-base-content/50">Loading link…</div>
				</li>
			{/if}
		{/key}
		<li role="none">
			<button
				type="button"
				role="menuitem"
				class="justify-start gap-2"
				onclick={() => openRename(fileActionsMenuItem)}
			>
				<LucidePencil class="size-4 shrink-0" aria-hidden="true" />
				Rename…
			</button>
		</li>
		<li role="none">
			<button
				type="button"
				role="menuitem"
				class="justify-start gap-2"
				onclick={() => openColorModal(fileActionsMenuItem)}
			>
				<LucidePalette class="size-4 shrink-0" aria-hidden="true" />
				Color…
			</button>
		</li>
		<li role="none">
			<button
				type="button"
				role="menuitem"
				class="text-error"
				onclick={() => void onTrash(fileActionsMenuItem)}
			>
				<span class="inline-flex items-center gap-2">
					<LucideTrash2 class="size-4 shrink-0" aria-hidden="true" />
					Move to trash
				</span>
			</button>
		</li>
	</ul>
{/if}

<dialog bind:this={renameDialogEl} class="d-modal" onclose={closeRename}>
	<div class="d-modal-box max-w-lg">
		<h3 class="d-font-title text-lg font-bold">Rename</h3>
		<label class="d-form-control mt-3 w-full">
			<span class="d-label-text">File name</span>
			<input
				type="text"
				class="d-input-bordered d-input w-full"
				bind:value={draftName}
				disabled={busyId !== null}
				onkeydown={(e) => e.key === 'Enter' && void submitRename()}
			/>
		</label>
		<div class="d-modal-action">
			<form method="dialog">
				<button type="submit" class="d-btn" disabled={busyId !== null}>Cancel</button>
			</form>
			<button
				type="button"
				class="d-btn d-btn-primary"
				disabled={busyId !== null}
				onclick={() => void submitRename()}
			>
				Save
			</button>
		</div>
	</div>
</dialog>

<dialog bind:this={shareDialogEl} class="d-modal" onclose={closeShare}>
	<div class="d-modal-box max-w-md">
		<h3 class="d-font-title text-lg font-bold">
			Share {shareTarget?.itemType === 'folder' ? 'folder' : 'file'}
		</h3>
		{#if shareTarget}
			<p class="py-2 text-sm text-base-content/70">{shareTarget.name}</p>
		{/if}
		<label class="d-form-control mt-2 w-full">
			<span class="d-label-text">Recipient email</span>
			<input
				type="email"
				class="d-input-bordered d-input w-full"
				bind:value={shareEmailDraft}
				disabled={shareSubmitting}
				placeholder="friend@example.com"
				onkeydown={(e) => e.key === 'Enter' && void submitShare()}
			/>
		</label>
		<p class="mt-2 text-xs text-base-content/60">
			{#if shareTarget?.itemType === 'folder'}
				They can open this folder and its contents under Shared while logged in with that email.
			{:else}
				They can download the decrypted file while logged in with that email (read access).
			{/if}
		</p>
		<div class="d-modal-action">
			<form method="dialog">
				<button type="submit" class="d-btn" disabled={shareSubmitting}>Cancel</button>
			</form>
			<button
				type="button"
				class="d-btn d-btn-primary"
				disabled={shareSubmitting || !shareEmailDraft.trim()}
				onclick={() => void submitShare()}
			>
				{shareSubmitting ? 'Sharing…' : 'Share'}
			</button>
		</div>
	</div>
</dialog>

<dialog bind:this={copyPublicLinkDialogEl} class="d-modal" onclose={closeCopyPublicLinkDialog}>
	<div class="d-modal-box max-w-lg">
		<h3 class="d-font-title text-lg font-bold">Copy public link</h3>
		{#if copyPublicLinkDialog}
			<p class="py-2 text-sm text-base-content/70">{copyPublicLinkDialog.name}</p>
			<div class="mt-2 space-y-4">
				<div class="d-form-control w-full">
					<span class="d-label-text">Share page (full URL)</span>
					<div class="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
						<input
							type="text"
							readonly
							class="d-input-bordered d-input w-full min-w-0 font-mono text-xs"
							value={copyPublicLinkDialog.shareUrl}
						/>
						<button
							type="button"
							class="d-btn shrink-0"
							onclick={(e) => copyDialogSharePageUrl(e)}
						>
							<LucideCopy class="size-4 shrink-0" aria-hidden="true" />
							Copy
						</button>
					</div>
				</div>
				{#if copyPublicLinkDialog.fileDirectUrl}
					<div class="d-form-control w-full">
						<span class="d-label-text">Direct file URL</span>
						<div class="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
							<input
								type="text"
								readonly
								class="d-input-bordered d-input w-full min-w-0 font-mono text-xs"
								value={copyPublicLinkDialog.fileDirectUrl}
							/>
							<button
								type="button"
								class="d-btn shrink-0"
								onclick={(e) => copyDialogDirectFileUrl(e)}
							>
								<LucideCopy class="size-4 shrink-0" aria-hidden="true" />
								Copy
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
		<div class="d-modal-action">
			<form method="dialog">
				<button type="submit" class="d-btn">Close</button>
			</form>
		</div>
	</div>
</dialog>

<dialog bind:this={colorDialogEl} class="d-modal" onclose={() => (colorTarget = null)}>
	<div class="d-modal-box max-w-md">
		<h3 class="d-font-title text-lg font-bold">Color</h3>
		{#if colorTarget}
			<p class="py-2 text-sm text-base-content/70">{colorTarget.name}</p>
		{/if}
		<div class="mt-3 flex flex-wrap gap-2">
			{#each FILE_LABEL_COLORS as c (c)}
				<button
					type="button"
					class="{fileLabelBadgeClass(c)} cursor-pointer"
					disabled={busyId !== null || !colorTarget}
					onclick={() => void pickColor(c)}
				>
					{colorLabel(c)}
				</button>
			{/each}
		</div>
		<div class="mt-3">
			<button
				type="button"
				class="d-btn d-btn-ghost d-btn-sm"
				disabled={busyId !== null || !colorTarget}
				onclick={() => void clearItemColor()}
			>
				Clear color
			</button>
		</div>
		<div class="d-modal-action">
			<form method="dialog">
				<button type="submit" class="d-btn" disabled={busyId !== null}>Close</button>
			</form>
		</div>
	</div>
</dialog>

{#snippet fileRowCells(item: DriveItem)}
	<td>
		{#if item.itemType === 'folder'}
			<button
				type="button"
				class="inline-flex max-w-full min-w-0 items-center gap-2 text-left font-medium hover:underline"
				onclick={() => enterFolder(item)}
			>
				<LucideFolder class="size-5 shrink-0 {fileLabelIconClass(item.color)}" aria-hidden="true" />
				<span class="truncate">{item.name}</span>
			</button>
		{:else}
			<span class="inline-flex max-w-full min-w-0 items-center gap-2">
				<AppMarkIcon
					class="size-5 shrink-0 {fileLabelIconClass(item.color ?? 'base')}"
				/>
				<span class="truncate font-medium">{item.name}</span>
			</span>
		{/if}
	</td>
	<td class="text-base-content/80 tabular-nums">{formatBytes(item.sizeBytes)}</td>
	<td class="text-base-content/80">{item.updatedAt}</td>
	<td class="text-sm">{storageProviderLabel(item.storageProvider)}</td>
	<td class="max-w-[10rem] truncate text-sm text-base-content/80" title={item.ownerName}>
		{item.ownerName}
	</td>
	<td class="text-center">
		<button
			type="button"
			class="d-btn d-btn-square d-btn-ghost d-btn-sm"
			aria-pressed={item.pinned}
			aria-label={item.pinned ? 'Unpin' : 'Pin'}
			disabled={busyId === item.id}
			onclick={() => void runPatch(item.id, { isPinned: !item.pinned })}
		>
			<LucidePin class="size-4 {item.pinned ? 'text-primary' : 'text-base-content/30'}" />
		</button>
	</td>
	<td class="text-center">
		<button
			type="button"
			class="d-btn d-btn-square d-btn-ghost d-btn-sm"
			aria-pressed={item.starred}
			aria-label={item.starred ? 'Unstar' : 'Star'}
			disabled={busyId === item.id}
			onclick={() => void runPatch(item.id, { isStarred: !item.starred })}
		>
			<LucideStar
				class="size-4 {item.starred ? 'fill-warning text-warning' : 'text-base-content/30'}"
			/>
		</button>
	</td>
	<td class="text-center">
		<button
			type="button"
			id={`file-actions-btn-${item.id}`}
			class="d-btn m-1 d-btn-square d-btn-ghost d-btn-sm"
			aria-label="File actions"
			aria-haspopup="menu"
			aria-expanded={openFileActionsId === item.id}
			disabled={busyId === item.id}
			onclick={(e) => void toggleFileActionsMenu(item.id, e.currentTarget as HTMLButtonElement)}
		>
			<LucideEllipsisVertical class="size-4" />
		</button>
	</td>
{/snippet}
