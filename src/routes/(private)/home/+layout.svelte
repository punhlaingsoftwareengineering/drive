<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { fetchWithSession } from '$lib/client/fetch-session';
	import { pathWithoutBase } from '$lib/url/path-without-base';
	import { resolveHref } from '$lib/url/resolve-href';
	import { page } from '$app/state';
	import { daisyDropdown } from '$lib/actions/daisy-dropdown';
	import { uploadFilesWithProgress } from '$lib/client/upload-drive';
	import { StatusColorEnum } from '$lib/model/enum/color.enum';
	import {
		STORAGE_PROVIDERS,
		type StorageProviderId,
		storageProviderLabel
	} from '$lib/model/storage-provider';
	import { bumpDriveListRefresh } from '$lib/state/drive-refresh.svelte';
	import {
		driveStorage,
		hydrateStorageProviderFromStorage,
		setCurrentStorageProvider
	} from '$lib/state/storage-provider.svelte';
	import { toastService } from '$lib/service/toast.service.svelte';
	import { getUserInitials } from '$lib/tool/user-initials';
	import AppProfileDialog from '$lib/components/app-profile-dialog.svelte';
	import AppSettingsDialog from '$lib/components/app-settings-dialog.svelte';
	import {
		LucideArrowLeft,
		LucideClock,
		LucideFolderPlus,
		LucideHouse,
		LucideLayoutDashboard,
		LucidePlus,
		LucideShare,
		LucideTrash,
		LucideUpload,
		LucideUserPlus,
		LucideUsers
	} from '@lucide/svelte';
	import { onMount } from 'svelte';

	let { data, children } = $props();

	const initials = $derived(getUserInitials(data.user));

	let uploadDialog = $state<HTMLDialogElement | null>(null);
	let newFolderDialog = $state<HTMLDialogElement | null>(null);
	let fileInputEl = $state<HTMLInputElement | null>(null);
	let pickerFiles = $state<File[]>([]);
	let uploadProgress = $state(0);
	let uploading = $state(false);
	let newFolderName = $state('');
	let creatingFolder = $state(false);

	let appSettingsDialog = $state<AppSettingsDialog | undefined>(undefined);
	let appProfileDialog = $state<AppProfileDialog | undefined>(undefined);

	let newTeamDialog = $state<HTMLDialogElement | null>(null);
	let newTeamName = $state('');
	let newTeamEmailDraft = $state('');
	let newTeamEmails = $state<string[]>([]);
	let creatingTeam = $state(false);

	let inviteTeamDialog = $state<HTMLDialogElement | null>(null);
	let inviteTeamEmails = $state<string[]>([]);
	let inviteTeamEmailDraft = $state('');
	let invitingTeam = $state(false);

	onMount(() => {
		hydrateStorageProviderFromStorage();
	});

	const driveParentForNew = $derived(
		data.teamView
			? (data.currentFolder?.id ?? data.teamView.rootFolderId)
			: (data.currentFolder?.id ?? null)
	);
	const activeStorageProvider = $derived(
		data.teamView?.storageProvider ?? driveStorage.current
	);

	function onStorageProviderSelect(e: Event) {
		const v = (e.currentTarget as HTMLSelectElement).value as StorageProviderId;
		setCurrentStorageProvider(v);
		toastService.addToast(`Storage target: ${storageProviderLabel(v)}`, StatusColorEnum.INFO);
	}

	function openUploadDialog() {
		pickerFiles = [];
		uploadProgress = 0;
		if (fileInputEl) fileInputEl.value = '';
		uploadDialog?.showModal();
	}

	function openUploadDialogFromMenu() {
		openUploadDialog();
	}

	function openNewFolderDialog() {
		newFolderName = '';
		queueMicrotask(() => newFolderDialog?.showModal());
	}

	function openNewTeamDialog() {
		newTeamName = '';
		newTeamEmailDraft = '';
		newTeamEmails = [];
		queueMicrotask(() => newTeamDialog?.showModal());
	}

	function addNewTeamEmailChip() {
		const raw = newTeamEmailDraft.trim();
		if (!raw) return;
		const parts = raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
		const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		for (const p of parts) {
			if (!re.test(p)) {
				toastService.addToast(`Invalid email: ${p}`, StatusColorEnum.WARNING);
				continue;
			}
			const lower = p.toLowerCase();
			if (!newTeamEmails.includes(lower)) newTeamEmails = [...newTeamEmails, lower];
		}
		newTeamEmailDraft = '';
	}

	function removeNewTeamEmail(email: string) {
		newTeamEmails = newTeamEmails.filter((e) => e !== email);
	}

	function openInviteTeamDialog() {
		inviteTeamEmails = [];
		inviteTeamEmailDraft = '';
		queueMicrotask(() => inviteTeamDialog?.showModal());
	}

	function addInviteTeamEmailChip() {
		const raw = inviteTeamEmailDraft.trim();
		if (!raw) return;
		const parts = raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
		const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		for (const p of parts) {
			if (!re.test(p)) {
				toastService.addToast(`Invalid email: ${p}`, StatusColorEnum.WARNING);
				continue;
			}
			const lower = p.toLowerCase();
			if (!inviteTeamEmails.includes(lower)) inviteTeamEmails = [...inviteTeamEmails, lower];
		}
		inviteTeamEmailDraft = '';
	}

	function removeInviteTeamEmail(email: string) {
		inviteTeamEmails = inviteTeamEmails.filter((e) => e !== email);
	}

	async function submitTeamInvites() {
		if (!data.teamView) return;
		addInviteTeamEmailChip();
		const toSend = [...inviteTeamEmails];
		if (toSend.length === 0) {
			toastService.addToast('Add at least one email', StatusColorEnum.WARNING);
			return;
		}
		invitingTeam = true;
		try {
			const r = await fetchWithSession(resolve(`/api/teams/${data.teamView.id}/invites`), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ inviteEmails: toSend })
			});
			if (!r.ok) throw new Error(await r.text());
			const j = (await r.json()) as { addedMembers?: number; pendingInvites?: number };
			const extra: string[] = [];
			if (j.addedMembers) extra.push(`${j.addedMembers} member(s) added`);
			if (j.pendingInvites) extra.push(`${j.pendingInvites} invite(s) pending`);
			toastService.addToast(
				extra.length ? `Invites sent — ${extra.join('; ')}` : 'No new invites (already members or pending)',
				extra.length ? StatusColorEnum.SUCCESS : StatusColorEnum.INFO
			);
			inviteTeamDialog?.close();
			inviteTeamEmails = [];
			inviteTeamEmailDraft = '';
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Invite failed',
				StatusColorEnum.ERROR
			);
		} finally {
			invitingTeam = false;
		}
	}

	async function submitNewTeam() {
		const name = newTeamName.trim();
		if (!name) {
			toastService.addToast('Enter a team name', StatusColorEnum.WARNING);
			return;
		}
		creatingTeam = true;
		try {
			const r = await fetchWithSession(resolve('/api/teams'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name,
					storageProvider: activeStorageProvider,
					inviteEmails: newTeamEmails
				})
			});
			if (!r.ok) throw new Error(await r.text());
			bumpDriveListRefresh();
			const j = (await r.json()) as { teamId?: string; addedMembers?: number; pendingInvites?: number };
			const extra: string[] = [];
			if (j.addedMembers) extra.push(`${j.addedMembers} member(s) added`);
			if (j.pendingInvites) extra.push(`${j.pendingInvites} invite(s) pending`);
			toastService.addToast(
				extra.length ? `Team created — ${extra.join('; ')}` : 'Team created',
				StatusColorEnum.SUCCESS
			);
			newTeamDialog?.close();
			const id = j.teamId;
			if (id) {
				void goto(resolve(`/home/team/${id}`));
			}
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Failed to create team',
				StatusColorEnum.ERROR
			);
		} finally {
			creatingTeam = false;
		}
	}

	async function submitNewFolder() {
		const name = newFolderName.trim();
		if (!name) {
			toastService.addToast('Enter a folder name', StatusColorEnum.WARNING);
			return;
		}
		creatingFolder = true;
		try {
			const r = await fetchWithSession(resolve('/api/drive/folders'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name,
					storageProvider: activeStorageProvider,
					...(driveParentForNew ? { parentId: driveParentForNew } : {}),
					...(data.teamView ? { teamId: data.teamView.id } : {})
				})
			});
			if (!r.ok) throw new Error(await r.text());
			bumpDriveListRefresh();
			toastService.addToast('Folder created', StatusColorEnum.SUCCESS);
			newFolderDialog?.close();
			newFolderName = '';
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Failed to create folder',
				StatusColorEnum.ERROR
			);
		} finally {
			creatingFolder = false;
		}
	}

	function onPickFiles(e: Event) {
		const l = (e.currentTarget as HTMLInputElement).files;
		pickerFiles = l && l.length ? Array.from(l) : [];
	}

	async function runUpload() {
		if (!pickerFiles.length) return;
		uploading = true;
		uploadProgress = 0;
		try {
			await uploadFilesWithProgress(
				pickerFiles,
				activeStorageProvider,
				(loaded, total) => {
					uploadProgress = total ? Math.round((100 * loaded) / total) : 0;
				},
				driveParentForNew,
				data.teamView?.id ?? null
			);
			bumpDriveListRefresh();
			toastService.addToast('Upload complete', StatusColorEnum.SUCCESS);
			uploadDialog?.close();
			pickerFiles = [];
			if (fileInputEl) fileInputEl.value = '';
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Upload failed';
			toastService.addToast(msg, StatusColorEnum.ERROR);
		} finally {
			uploading = false;
			uploadProgress = 0;
		}
	}

	type BreadcrumbItem = { href: string | null; label: string; isLast: boolean };

	function formatBreadcrumbLabel(segment: string): string {
		try {
			const decoded = decodeURIComponent(segment);
			return decoded.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
		} catch {
			return segment;
		}
	}

	const breadcrumbs = $derived.by((): BreadcrumbItem[] => {
		if (data.trashView) {
			return [
				{ href: resolve('/home'), label: 'Home', isLast: false },
				{ href: null, label: 'Trash', isLast: true }
			];
		}
		if (data.recentView) {
			return [
				{ href: resolve('/home'), label: 'Home', isLast: false },
				{ href: null, label: 'Recent', isLast: true }
			];
		}
		if (data.sharedView) {
			if (data.currentFolder) {
				return [
					{ href: resolve('/home'), label: 'Home', isLast: false },
					{ href: resolve('/home/shared'), label: 'Shared', isLast: false },
					{ href: null, label: data.currentFolder.name, isLast: true }
				];
			}
			return [
				{ href: resolve('/home'), label: 'Home', isLast: false },
				{ href: null, label: 'Shared', isLast: true }
			];
		}
		if (data.teamView) {
			if (data.currentFolder) {
				return [
					{ href: resolve('/home'), label: 'Home', isLast: false },
					{ href: resolve(`/home/team/${data.teamView.id}`), label: data.teamView.name, isLast: false },
					{ href: null, label: data.currentFolder.name, isLast: true }
				];
			}
			return [
				{ href: resolve('/home'), label: 'Home', isLast: false },
				{ href: null, label: data.teamView.name, isLast: true }
			];
		}
		if (data.currentFolder) {
			return [
				{ href: resolve('/home'), label: 'Home', isLast: false },
				{ href: null, label: data.currentFolder.name, isLast: true }
			];
		}

		const segments = pathWithoutBase(page.url.pathname).split('/').filter(Boolean);
		if (segments.length === 0 || (segments.length === 1 && segments[0] === 'home')) {
			return [{ href: null, label: 'Home', isLast: true }];
		}

		if (segments[0] === 'home' && segments.length >= 2) {
			const crumbs: BreadcrumbItem[] = [{ href: resolve('/home'), label: 'Home', isLast: false }];
			for (let i = 1; i < segments.length; i++) {
				const isLast = i === segments.length - 1;
				const pathToHere = '/' + segments.slice(0, i + 1).join('/');
				crumbs.push({
					href: isLast ? null : resolveHref(pathToHere),
					label: formatBreadcrumbLabel(segments[i]),
					isLast
				});
			}
			return crumbs;
		}

		return segments.map((segment, i) => ({
			href:
				i === segments.length - 1 ? null : resolveHref('/' + segments.slice(0, i + 1).join('/')),
			label: formatBreadcrumbLabel(segment),
			isLast: i === segments.length - 1
		}));
	});

	const upFolderHref = $derived.by(() => {
		if (!data.currentFolder) {
			if (data.trashView) return resolve('/home/trash');
			if (data.recentView) return resolve('/home');
			if (data.sharedView) return resolve('/home/shared');
			if (data.teamView) return resolve(`/home/team/${data.teamView.id}`);
			return resolve('/home');
		}
		return data.currentFolder.upHref;
	});

	/** Heading: current folder name or last URL segment. */
	const pageTitle = $derived.by(() => {
		if (data.trashView) return 'Trash';
		if (data.recentView) return 'Recent';
		if (data.sharedView) return data.currentFolder?.name ?? 'Shared';
		if (data.teamView) return data.currentFolder?.name ?? data.teamView.name;
		if (data.currentFolder) return data.currentFolder.name;
		const segments = pathWithoutBase(page.url.pathname).split('/').filter(Boolean);
		const last = segments.at(-1);
		if (!last) return 'Home';
		return formatBreadcrumbLabel(last);
	});

	const newActionsDisabled = $derived(
		Boolean(data.sharedView || data.trashView || data.recentView)
	);
	const newActionsTooltip = $derived(
		data.trashView
			? 'New folders and uploads are only available in Home, not in Trash.'
			: data.sharedView
				? 'New folders and uploads are only available in Home, not in Shared.'
				: data.recentView
					? 'New folders and uploads are only available in Home, not on Recent.'
					: ''
	);
</script>

<div class="my-app flex min-h-screen flex-col">
	<div class="d-navbar bg-base-100 shadow-sm">
		<div class="d-navbar-start">
			<a class="d-btn text-xl d-btn-ghost" href={resolve('/home')}>ZNL-DRIVE</a>
		</div>
		<div class="d-navbar-end gap-3 sm:gap-4">
			<a
				href={localizeHref('/onboarding/docs')}
				class="d-btn hidden d-btn-ghost d-btn-sm md:inline-flex"
				target="_blank"
				rel="noopener noreferrer"
			>
				Docs
			</a>
			<select
				class="d-select-bordered d-select max-w-[12rem] min-w-[10rem] {!data.teamView
					? ''
					: 'cursor-not-allowed opacity-80'}"
				value={activeStorageProvider}
				onchange={onStorageProviderSelect}
				aria-label="Storage provider"
				disabled={Boolean(data.teamView)}
			>
				{#each STORAGE_PROVIDERS as provider (provider)}
					<option value={provider}>{storageProviderLabel(provider)}</option>
				{/each}
			</select>
			<div class="d-dropdown d-dropdown-end" use:daisyDropdown>
				<div tabindex="0" role="button" class="d-btn d-avatar m-1 d-btn-circle d-btn-ghost">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-full ring-2 ring-primary ring-offset-2 ring-offset-base-100"
					>
						<span class="text-lg font-bold select-none">{initials}</span>
					</div>
				</div>
				<ul
					tabindex="-1"
					class="d-dropdown-content d-menu z-1 mt-1 w-52 rounded-box bg-base-100 p-2 shadow-sm"
				>
					<li>
						<button
							type="button"
							class="flex w-full items-center justify-between text-left"
							onclick={() => appProfileDialog?.open()}
						>
							Profile
							<span class="d-badge">New</span>
						</button>
					</li>
					<li>
						<button
							type="button"
							class="w-full text-left"
							onclick={() => appSettingsDialog?.open()}
						>
							Settings
						</button>
					</li>
					<li>
						<form method="POST" action={resolve(`/api/auth/logout`)}>
							<button type="submit" class="w-full text-left">Logout</button>
						</form>
					</li>
				</ul>
			</div>
		</div>
	</div>
	<main class="my-main flex min-h-0 flex-1 flex-col">
		<div class="flex min-h-0 flex-1 px-5 py-5">
			<!-- Sidebar -->
			<aside class="flex h-full w-64 shrink-0 flex-col">
				<!-- NEW: folder or upload (disabled on Shared / Trash with tooltip) -->
				{#if newActionsDisabled}
					<div class="d-tooltip d-tooltip-bottom w-full" data-tip={newActionsTooltip}>
						<button
							type="button"
							class="d-btn m-1 d-btn-wide w-full max-w-full cursor-not-allowed opacity-50 d-btn-primary"
							disabled
						>
							<LucidePlus class="size-4 shrink-0" aria-hidden="true" />
							NEW
						</button>
					</div>
				{:else}
					<div class="d-dropdown d-dropdown-bottom w-full" use:daisyDropdown>
						<div
							tabindex="0"
							role="button"
							class="d-btn m-1 d-btn-wide w-full max-w-full d-btn-primary"
						>
							<LucidePlus class="size-4 shrink-0" aria-hidden="true" />
							NEW
						</div>
						<ul
							tabindex="-1"
							class="d-dropdown-content d-menu z-1 mt-1 w-full max-w-full min-w-[12rem] rounded-box bg-base-100 p-2 shadow-sm"
						>
							<li>
								<button
									type="button"
									class="w-full justify-start gap-2"
									onclick={openNewFolderDialog}
								>
									<LucideFolderPlus class="size-4 shrink-0" aria-hidden="true" />
									New folder
								</button>
							</li>
							<li>
								<button
									type="button"
									class="w-full justify-start gap-2"
									onclick={openUploadDialogFromMenu}
								>
									<LucideUpload class="size-4 shrink-0" aria-hidden="true" />
									Upload file
								</button>
							</li>
							<li>
								<button
									type="button"
									class="w-full justify-start gap-2"
									onclick={openNewTeamDialog}
								>
									<LucideUsers class="size-4 shrink-0" aria-hidden="true" />
									New team
								</button>
							</li>
						</ul>
					</div>
				{/if}

				<dialog bind:this={uploadDialog} class="d-modal">
					<div class="d-modal-box max-w-lg">
						<h3 class="d-font-title text-lg font-bold">Upload files</h3>
						<p class="py-2 text-sm text-base-content/70">
							Using storage: <strong>{storageProviderLabel(activeStorageProvider)}</strong>
							— local files go to <code class="text-xs">~/Documents/znl-drive/</code>; Tigris uses
							your bucket.
						</p>
						<input
							bind:this={fileInputEl}
							type="file"
							multiple
							class="d-file-input-bordered d-file-input w-full max-w-full"
							onchange={onPickFiles}
						/>
						{#if pickerFiles.length > 0}
							<p class="py-2 text-sm text-base-content/80">{pickerFiles.length} file(s) selected</p>
						{/if}
						{#if uploading}
							<progress
								class="d-progress mt-3 w-full d-progress-info"
								value={uploadProgress}
								max="100"
							></progress>
							<p class="mt-1 text-xs text-base-content/60">{uploadProgress}%</p>
						{/if}
						<div class="d-modal-action">
							<form method="dialog">
								<button type="submit" class="d-btn" disabled={uploading}>Cancel</button>
							</form>
							<button
								type="button"
								class="d-btn d-btn-primary"
								disabled={!pickerFiles.length || uploading}
								onclick={runUpload}
							>
								{uploading ? 'Uploading…' : 'Upload'}
							</button>
						</div>
					</div>
				</dialog>

				<dialog bind:this={newFolderDialog} class="d-modal">
					<div class="d-modal-box max-w-md">
						<h3 class="d-font-title text-lg font-bold">New folder</h3>
						<p class="py-2 text-sm text-base-content/70">
							Storage: <strong>{storageProviderLabel(activeStorageProvider)}</strong>
						</p>
						<label class="d-form-control w-full">
							<span class="d-label-text">Folder name</span>
							<input
								type="text"
								class="d-input-bordered d-input w-full"
								bind:value={newFolderName}
								disabled={creatingFolder}
								placeholder="My folder"
								onkeydown={(e) => e.key === 'Enter' && void submitNewFolder()}
							/>
						</label>
						<div class="d-modal-action">
							<form method="dialog">
								<button type="submit" class="d-btn" disabled={creatingFolder}>Cancel</button>
							</form>
							<button
								type="button"
								class="d-btn d-btn-primary"
								disabled={creatingFolder || !newFolderName.trim()}
								onclick={() => void submitNewFolder()}
							>
								{creatingFolder ? 'Creating…' : 'Create'}
							</button>
						</div>
					</div>
				</dialog>

				<dialog bind:this={newTeamDialog} class="d-modal">
					<div class="d-modal-box max-w-lg">
						<h3 class="d-font-title text-lg font-bold">New team</h3>
						<p class="py-2 text-sm text-base-content/70">
							Shared drive for you and members. Storage:
							<strong>{storageProviderLabel(activeStorageProvider)}</strong> (applies to this team)
						</p>
						<label class="d-form-control w-full max-w-md">
							<span class="d-label-text">Team name</span>
							<input
								type="text"
								class="d-input-bordered d-input w-full"
								bind:value={newTeamName}
								disabled={creatingTeam}
								placeholder="My team"
								onkeydown={(e) => e.key === 'Enter' && void submitNewTeam()}
							/>
						</label>
						<div class="d-form-control mt-3 w-full max-w-md">
							<span class="d-label-text">Invite others (emails)</span>
							<div class="flex flex-wrap items-center gap-1 rounded-lg border border-base-300 bg-base-200/30 p-2">
								{#each newTeamEmails as em (em)}
									<span class="d-badge d-badge-ghost gap-1"
										>{em}
										<button
											type="button"
											class="d-btn d-btn-ghost d-btn-xs min-h-0 px-0"
											onclick={() => removeNewTeamEmail(em)}
											aria-label="Remove">×</button
										></span
									>
								{/each}
								<input
									type="text"
									class="d-input-ghost d-input d-input-sm min-w-[8rem] flex-1"
									placeholder="user@example.com"
									bind:value={newTeamEmailDraft}
									disabled={creatingTeam}
									autocomplete="off"
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ',') {
											e.preventDefault();
											addNewTeamEmailChip();
										}
									}}
									onblur={() => addNewTeamEmailChip()}
								/>
							</div>
						</div>
						<div class="d-modal-action">
							<form method="dialog">
								<button type="submit" class="d-btn" disabled={creatingTeam}>Cancel</button>
							</form>
							<button
								type="button"
								class="d-btn d-btn-primary"
								disabled={creatingTeam || !newTeamName.trim()}
								onclick={() => void submitNewTeam()}
							>
								{creatingTeam ? 'Creating…' : 'Create team'}
							</button>
						</div>
					</div>
				</dialog>

				<dialog bind:this={inviteTeamDialog} class="d-modal">
					<div class="d-modal-box max-w-lg">
						<h3 class="d-font-title text-lg font-bold">
							Invite people{#if data.teamView}<span class="text-base-content/70"> — {data.teamView.name}</span>{/if}
						</h3>
						<p class="py-2 text-sm text-base-content/70">
							Registered users join immediately; others get a pending invite for when they sign up.
						</p>
						<div class="d-form-control w-full max-w-md">
							<span class="d-label-text">Email addresses</span>
							<div class="flex flex-wrap items-center gap-1 rounded-lg border border-base-300 bg-base-200/30 p-2">
								{#each inviteTeamEmails as em (em)}
									<span class="d-badge d-badge-ghost gap-1"
										>{em}
										<button
											type="button"
											class="d-btn d-btn-ghost d-btn-xs min-h-0 px-0"
											onclick={() => removeInviteTeamEmail(em)}
											aria-label="Remove">×</button
										></span
									>
								{/each}
								<input
									type="text"
									class="d-input-ghost d-input d-input-sm min-w-[8rem] flex-1"
									placeholder="user@example.com"
									bind:value={inviteTeamEmailDraft}
									disabled={invitingTeam}
									autocomplete="off"
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ',') {
											e.preventDefault();
											addInviteTeamEmailChip();
										}
									}}
									onblur={() => addInviteTeamEmailChip()}
								/>
							</div>
						</div>
						<div class="d-modal-action">
							<form method="dialog">
								<button type="submit" class="d-btn" disabled={invitingTeam}>Cancel</button>
							</form>
							<button
								type="button"
								class="d-btn d-btn-primary"
								disabled={invitingTeam}
								onclick={() => void submitTeamInvites()}
							>
								{invitingTeam ? 'Sending…' : 'Send invites'}
							</button>
						</div>
					</div>
				</dialog>

				<span class="d-divider"></span>

				<!-- Pages -->
				<div class="flex flex-col gap-2">
					<a
						class="d-btn d-btn-wide d-btn-ghost d-btn-outline d-btn-primary"
						href={resolve('/home')}
					>
						<LucideHouse class="size-4" />
						Home</a
					>
					<a
						class="d-btn d-btn-wide d-btn-ghost d-btn-outline d-btn-secondary"
						href={resolve('/home/shared')}
					>
						<LucideShare class="size-4" />
						Shared</a
					>
					<a
						class="d-btn d-btn-wide d-btn-ghost d-btn-outline d-btn-accent"
						href={resolve('/home/recent')}
					>
						<LucideClock class="size-4" />
						Recent</a
					>
					<a
						class="d-btn d-btn-wide d-btn-ghost d-btn-outline d-btn-error"
						href={resolve('/home/trash')}
					>
						<LucideTrash class="size-4" />
						Trash</a
					>
					<a
						class="d-btn d-btn-wide d-btn-ghost d-btn-outline d-btn-success"
						href={resolve('/home/dashboard')}
					>
						<LucideLayoutDashboard class="size-4" />
						Dashboard</a
					>
				</div>

				<span class="d-divider"></span>
				<div class="flex flex-col gap-2">
					<p class="px-1 text-xs font-semibold tracking-wide text-base-content/50 uppercase">Teams</p
					>
					{#if data.teams.length === 0}
						<p class="px-1 text-sm text-base-content/50">No teams yet — use <strong>NEW</strong> →
							<strong>New team</strong></p
						>
					{:else}
						{#each data.teams as t (t.id)}
							<a
								class="d-btn d-btn-wide d-btn-ghost d-btn-outline d-btn-sm"
								href={resolve(`/home/team/${t.id}`)}
							>
								<LucideUsers class="size-4" />
								<span class="truncate text-left">{t.name}</span>
							</a>
						{/each}
					{/if}
				</div>
			</aside>
			<!-- Main Content -->
			<div class="flex min-h-0 min-w-0 flex-1 flex-col px-5">
				<div
					class="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 rounded-lg bg-base-100 p-4"
				>
					<div class="min-w-0">
						<div class="flex min-w-0 flex-wrap items-center gap-2">
							{#if data.currentFolder}
								<a class="d-btn shrink-0 gap-1 d-btn-ghost d-btn-sm" href={upFolderHref}>
									<LucideArrowLeft class="size-4" aria-hidden="true" />
									Up
								</a>
							{/if}
							<h1 class="min-w-0 text-2xl font-bold break-words">{pageTitle}</h1>
						</div>
					</div>
					<div class="self-start text-right text-sm font-medium text-error">
						{storageProviderLabel(activeStorageProvider)}
					</div>

					<nav
						class="d-breadcrumbs min-w-0 italic [&_ul]:flex-wrap {data.teamView
							? ''
							: 'col-span-2'}"
						aria-label="Breadcrumb"
					>
						<ul>
							{#each breadcrumbs as crumb, i (String(i) + (crumb.href ?? '') + crumb.label)}
								<li>
									{#if crumb.isLast}
										<span aria-current="page">{crumb.label}</span>
									{:else if crumb.href}
										<a href={crumb.href}>{crumb.label}</a>
									{:else}
										<span>{crumb.label}</span>
									{/if}
								</li>
							{/each}
						</ul>
					</nav>
					{#if data.teamView}
						<div
							class="d-tooltip d-tooltip-bottom d-tooltip-primary flex justify-end self-center"
							data-tip="Invite"
						>
							<button
								type="button"
								class="d-btn d-btn-secondary d-btn-square d-btn-sm"
								onclick={openInviteTeamDialog}
								aria-label="Invite people to {data.teamView.name}"
							>
								<LucideUserPlus class="size-4" aria-hidden="true" />
							</button>
						</div>
					{/if}
				</div>
				<div class="flex min-h-0 flex-1 flex-col pt-4">
					{@render children?.()}
				</div>
			</div>
		</div>
	</main>
</div>

<AppProfileDialog
	user={data.user}
	appVersion={data.appVersion}
	developerModeEnabled={data.developerModeEnabled}
	bind:this={appProfileDialog}
/>
<AppSettingsDialog bind:this={appSettingsDialog} />
