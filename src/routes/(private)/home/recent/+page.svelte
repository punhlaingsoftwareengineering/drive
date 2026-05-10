<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { fetchWithSession } from '$lib/client/fetch-session';
	import { resolveHref } from '$lib/url/resolve-href';
	import { page } from '$app/state';
	import { copyTextToClipboard } from '$lib/client/copy-text';
	import {
		downloadDriveFileAsBlob,
		patchDriveFile,
		shareDriveFile,
		type PatchDriveFileBody
	} from '$lib/client/drive-file';
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
	import { bumpDriveListRefresh, registerDriveListReload } from '$lib/state/drive-refresh.svelte';
	import { driveStorage } from '$lib/state/storage-provider.svelte';
	import { toastService } from '$lib/service/toast.service.svelte';
	import { formatBytes } from '$lib/tool/format-bytes';
	import {
		LucideCopy,
		LucideDownload,
		LucideEllipsisVertical,
		LucideFile,
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


	type Source = 'own' | 'shared' | 'team';

	type ApiFile = {
		id: string;
		name: string;
		itemType: string;
		sizeBytes: number;
		updatedAt: string;
		recencyAt: string;
		storageProvider: StorageProviderId;
		isPinned: boolean;
		isStarred: boolean;
		color: string | null;
		parentId: string | null;
		ownerName: string;
		source: Source;
		teamId: string | null;
		teamName: string | null;
		sharePermission: string | null;
	};

	type DriveItem = {
		id: string;
		name: string;
		itemType: 'file' | 'folder';
		sizeBytes: number | null;
		updatedAt: string;
		recencyAt: string;
		storageProvider: StorageProviderId;
		pinned: boolean;
		starred: boolean;
		color: FileLabelColorId | string | null;
		parentId: string | null;
		ownerName: string;
		source: Source;
		teamId: string | null;
		teamName: string | null;
		sharePermission: string | null;
	};

	let rows = $state<DriveItem[]>([]);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
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
		imageDirectUrl?: string;
	} | null>(null);

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
				imageDirectUrl?: string;
				copyUrl: string;
		  };

	let publicLinkMeta = $state<Record<string, PublicLinkMeta>>({});

	function canEditItem(item: DriveItem): boolean {
		return item.source === 'own' || item.source === 'team';
	}

	function whereLabel(item: DriveItem): string {
		if (item.source === 'own') return 'My files';
		if (item.source === 'shared') return 'Shared with you';
		return item.teamName?.trim() || 'Team';
	}

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
						imageDirectUrl?: string;
						copyUrl: string;
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
			imageDirectUrl: meta.imageDirectUrl
		};
		queueMicrotask(() => copyPublicLinkDialogEl?.showModal());
	}

	async function copyPublicLinkField(url: string, toastMsg: string) {
		try {
			await copyTextToClipboard(url);
			toastService.addToast(toastMsg, StatusColorEnum.SUCCESS);
		} catch {
			toastService.addToast(
				'Could not copy automatically — select the text in the field and copy manually',
				StatusColorEnum.WARNING
			);
		}
	}

	async function copyDialogSharePageUrl() {
		const d = copyPublicLinkDialog;
		if (!d) return;
		await copyPublicLinkField(d.shareUrl, 'Share page link copied');
	}

	async function copyDialogDirectImageUrl() {
		const d = copyPublicLinkDialog;
		if (!d?.imageDirectUrl) return;
		await copyPublicLinkField(d.imageDirectUrl, 'Direct image link copied');
	}

	function closeCopyPublicLinkDialog() {
		copyPublicLinkDialog = null;
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
		const menuEl = document.getElementById('recent-file-actions-menu-float');
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
		const menu = document.getElementById('recent-file-actions-menu-float');
		if (!menu) return;
		const t = e.target;
		if (!t || !(t instanceof Node)) return;
		if (menu.contains(t)) return;
		const openFor = menu.getAttribute('data-open-for');
		if (!openFor) return;
		const trigger = document.getElementById(`recent-file-actions-btn-${openFor}`);
		if (trigger?.contains(t)) return;
		closeFileActionsMenu();
	}

	onMount(() => {
		void loadRecent();
		const unregister = registerDriveListReload(() => void loadRecent());
		document.addEventListener('keydown', onDocumentEscape, true);
		document.addEventListener('pointerdown', onDocumentPointerDownCloseMenu, true);
		return () => {
			unregister();
			document.removeEventListener('keydown', onDocumentEscape, true);
			document.removeEventListener('pointerdown', onDocumentPointerDownCloseMenu, true);
		};
	});

	afterNavigate(() => {
		if (browser) void loadRecent();
	});

	function mapRow(f: ApiFile): DriveItem {
		return {
			id: f.id,
			name: f.name,
			itemType: f.itemType === 'folder' ? 'folder' : 'file',
			sizeBytes: f.sizeBytes,
			updatedAt: f.updatedAt.slice(0, 10),
			recencyAt: f.recencyAt.slice(0, 10),
			storageProvider: f.storageProvider,
			pinned: f.isPinned,
			starred: f.isStarred,
			color: f.color as FileLabelColorId | null,
			parentId: f.parentId ?? null,
			ownerName: f.ownerName,
			source: f.source,
			teamId: f.teamId,
			teamName: f.teamName,
			sharePermission: f.sharePermission
		};
	}

	function enterFolder(item: DriveItem) {
		if (item.itemType !== 'folder') return;
		if (item.source === 'own') {
			void goto(`${resolve('/home')}?folder=${encodeURIComponent(item.id)}`);
		} else if (item.source === 'shared') {
			void goto(`${resolve('/home/shared')}?folder=${encodeURIComponent(item.id)}`);
		} else if (item.source === 'team' && item.teamId) {
			void goto(
				`${resolve(`/home/team/${item.teamId}`)}?folder=${encodeURIComponent(item.id)}`
			);
		}
	}

	async function loadRecent() {
		loading = true;
		loadError = null;
		try {
			const qs = new URLSearchParams({ storageProvider: driveStorage.current });
			const r = await fetchWithSession(`${resolveHref('/api/drive/recent')}?${qs}`);
			if (!r.ok) {
				const t = await r.text();
				throw new Error(t || r.statusText);
			}
			const payload = (await r.json()) as { files: ApiFile[] };
			rows = payload.files.map(mapRow);
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load recent';
			rows = [];
		} finally {
			loading = false;
		}
	}

	const partitionedRecent = $derived.by(() => {
		const pinned: DriveItem[] = [];
		const starred: DriveItem[] = [];
		const other: DriveItem[] = [];
		for (const r of rows) {
			if (r.pinned) pinned.push(r);
			else if (r.starred) starred.push(r);
			else other.push(r);
		}
		return { pinned, starred, other };
	});

	const fileActionsMenuItem = $derived(
		openFileActionsId
			? (rows.find((r) => r.id === openFileActionsId) ?? null)
			: null
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

	async function onDownloadShared(item: DriveItem) {
		busyId = item.id;
		try {
			const fallback = item.itemType === 'folder' ? `${item.name}.zip` : item.name;
			await downloadDriveFileAsBlob(item.id, fallback);
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Download failed',
				StatusColorEnum.ERROR
			);
		} finally {
			busyId = null;
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
</script>

<div class="flex min-h-0 flex-1 flex-col gap-6 pb-8">
	<p class="shrink-0 text-sm text-base-content/70">
		Items from your home drive, things shared with you, and team drives you belong to. Ordered by
		<strong>when the item was created</strong> (your files) or
		<strong>when you first got access</strong> (shared with you, or team membership vs file
		creation), latest first. Open a folder to work with it in its normal place. Filtered by the
		storage provider in the header.
	</p>

	{#if loading && rows.length === 0}
		<div class="h-40 w-full d-skeleton"></div>
	{:else if loadError}
		<div class="d-alert d-alert-error">
			<span>{loadError}</span>
		</div>
	{/if}

	<div
		class="d-card flex min-h-0 flex-1 flex-col border border-base-300 bg-base-100 shadow-sm"
		role="region"
		aria-label="Recent files"
	>
		<div class="d-card-body flex min-h-0 flex-1 flex-col p-0">
			<div class="min-h-0 flex-1 overflow-auto" onscroll={closeFileActionsMenu}>
				<table class="d-table w-full min-w-[60rem] d-table-zebra">
					<thead>
						<tr class="border-b border-base-300">
							<th class="min-w-[12rem]">Name</th>
							<th class="min-w-[7rem]">Where</th>
							<th class="w-28">Size</th>
							<th class="w-36">Modified</th>
							<th class="w-36">Recent</th>
							<th class="w-32">Storage</th>
							<th class="min-w-[6rem]">Owner</th>
							<th class="w-24 text-center">Pin</th>
							<th class="w-24 text-center">Star</th>
							<th class="w-14 text-center"></th>
						</tr>
					</thead>
					<tbody>
						{#snippet recentRow(item: DriveItem)}
							<tr
								class="border-l-4 transition-colors hover:bg-info/50 {fileLabelBorderClass(
									item.color
								)}"
							>
								<td>
									{#if item.itemType === 'folder'}
										<button
											type="button"
											class="inline-flex max-w-full min-w-0 items-center gap-2 text-left font-medium hover:underline"
											onclick={() => enterFolder(item)}
										>
											<LucideFolder
												class="size-5 shrink-0 {fileLabelIconClass(item.color)}"
												aria-hidden="true"
											/>
											<span class="truncate">{item.name}</span>
										</button>
									{:else}
										<span class="inline-flex max-w-full min-w-0 items-center gap-2">
											<LucideFile
												class="size-5 shrink-0 {fileLabelIconClass(item.color ?? 'base')}"
												aria-hidden="true"
											/>
											<span class="truncate font-medium">{item.name}</span>
										</span>
									{/if}
								</td>
								<td class="max-w-[9rem] truncate text-sm" title={whereLabel(item)}>
									{whereLabel(item)}
								</td>
								<td class="text-base-content/80 tabular-nums">{formatBytes(item.sizeBytes)}</td>
								<td class="text-base-content/80">{item.updatedAt}</td>
								<td class="text-base-content/80">{item.recencyAt}</td>
								<td class="text-sm">{storageProviderLabel(item.storageProvider)}</td>
								<td class="max-w-[8rem] truncate text-sm text-base-content/80" title={item.ownerName}>
									{item.ownerName}
								</td>
								<td class="text-center">
									{#if canEditItem(item)}
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
									{:else}
										<span class="text-base-content/30">—</span>
									{/if}
								</td>
								<td class="text-center">
									{#if canEditItem(item)}
										<button
											type="button"
											class="d-btn d-btn-square d-btn-ghost d-btn-sm"
											aria-pressed={item.starred}
											aria-label={item.starred ? 'Unstar' : 'Star'}
											disabled={busyId === item.id}
											onclick={() => void runPatch(item.id, { isStarred: !item.starred })}
										>
											<LucideStar
												class="size-4 {item.starred
													? 'fill-warning text-warning'
													: 'text-base-content/30'}"
											/>
										</button>
									{:else}
										<span class="text-base-content/30">—</span>
									{/if}
								</td>
								<td class="text-center">
									{#if item.source === 'shared'}
										<button
											type="button"
											class="d-btn m-1 d-btn-square d-btn-ghost d-btn-sm"
											aria-label="Download"
											disabled={busyId === item.id}
											onclick={() => void onDownloadShared(item)}
										>
											<LucideDownload class="size-4" />
										</button>
									{:else}
										<button
											type="button"
											id={`recent-file-actions-btn-${item.id}`}
											class="d-btn m-1 d-btn-square d-btn-ghost d-btn-sm"
											aria-label="File actions"
											aria-haspopup="menu"
											aria-expanded={openFileActionsId === item.id}
											disabled={busyId === item.id}
											onclick={(e) =>
												void toggleFileActionsMenu(
													item.id,
													e.currentTarget as HTMLButtonElement
												)}
										>
											<LucideEllipsisVertical class="size-4" />
										</button>
									{/if}
								</td>
							</tr>
						{/snippet}
						<tr class="bg-base-200/60 hover:bg-base-200/60">
							<td colspan="10" class="py-2 text-xs font-semibold tracking-wide text-base-content/80">
								Recent — {storageProviderLabel(driveStorage.current)}
							</td>
						</tr>
						{#if rows.length === 0 && !loading}
							<tr>
								<td colspan="10" class="py-8 text-center text-base-content/60">
									No files or folders for this storage yet, or nothing matches your other drives.
								</td>
							</tr>
						{:else}
							{#if partitionedRecent.pinned.length > 0}
								<tr class="bg-base-200/60 hover:bg-base-200/60">
									<td
										colspan="10"
										class="py-2 text-xs font-semibold tracking-wide text-base-content/80 uppercase"
									>
										<span class="inline-flex items-center gap-2">
											<LucidePin class="size-3.5" aria-hidden="true" />
											Pinned
										</span>
									</td>
								</tr>
								{#each partitionedRecent.pinned as item (item.id)}
									{@render recentRow(item)}
								{/each}
							{/if}
							{#if partitionedRecent.starred.length > 0}
								<tr class="bg-base-200/60 hover:bg-base-200/60">
									<td
										colspan="10"
										class="py-2 text-xs font-semibold tracking-wide text-base-content/80 uppercase"
									>
										<span class="inline-flex items-center gap-2">
											<LucideStar class="size-3.5" aria-hidden="true" />
											Starred
										</span>
									</td>
								</tr>
								{#each partitionedRecent.starred as item (item.id)}
									{@render recentRow(item)}
								{/each}
							{/if}
							{#if partitionedRecent.other.length > 0}
								{#if partitionedRecent.pinned.length > 0 || partitionedRecent.starred.length > 0}
									<tr class="bg-base-200/60 hover:bg-base-200/60">
										<td
											colspan="10"
											class="py-2 text-xs font-semibold tracking-wide text-base-content/80 uppercase"
										>
											More
										</td>
									</tr>
								{/if}
								{#each partitionedRecent.other as item (item.id)}
									{@render recentRow(item)}
								{/each}
							{/if}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>

{#if openFileActionsId && fileActionsMenuPosition && fileActionsMenuItem && canEditItem(fileActionsMenuItem)}
	<ul
		id="recent-file-actions-menu-float"
		data-open-for={fileActionsMenuItem.id}
		role="menu"
		class="d-menu fixed z-[999] m-0 max-w-[90vw] min-w-[20rem] rounded-box border border-base-200 bg-base-100 p-2 shadow-md"
		style="top: {fileActionsMenuPosition.top}px; left: {fileActionsMenuPosition.left}px;"
	>
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
							onclick={() => void copyDialogSharePageUrl()}
						>
							<LucideCopy class="size-4 shrink-0" aria-hidden="true" />
							Copy
						</button>
					</div>
				</div>
				{#if copyPublicLinkDialog.imageDirectUrl}
					<div class="d-form-control w-full">
						<span class="d-label-text">Direct image URL</span>
						<div class="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
							<input
								type="text"
								readonly
								class="d-input-bordered d-input w-full min-w-0 font-mono text-xs"
								value={copyPublicLinkDialog.imageDirectUrl}
							/>
							<button
								type="button"
								class="d-btn shrink-0"
								onclick={() => void copyDialogDirectImageUrl()}
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
