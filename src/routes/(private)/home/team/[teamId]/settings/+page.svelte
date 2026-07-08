<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { fetchWithSession } from '$lib/client/fetch-session';
	import { resolveHref } from '$lib/url/resolve-href';
	import { bumpDriveListRefresh } from '$lib/state/drive-refresh.svelte';
	import { toastService } from '$lib/service/toast.service.svelte';
	import { StatusColorEnum } from '$lib/model/enum/color.enum';
	import { teamRoleLabel, type TeamRole } from '$lib/model/team-role';
	import {
		formatTeamApiKeyPermissionsSummary,
		permissionsGrantableByRole,
		TEAM_API_KEY_PERMISSION_GROUPS,
		type TeamApiKeyPermission
	} from '$lib/model/team-api-key-permission';
	import { LucideKey, LucideLogOut, LucideSettings, LucideTrash2, LucideUserMinus, LucideUserPlus } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const team = $derived(data.teamView!);
	const currentUserId = $derived(data.user?.id ?? '');
	const developerModeEnabled = $derived(data.developerModeEnabled ?? false);

	type TeamApiKeyRow = {
		id: string;
		name: string;
		masked: string;
		createdAt: string | null;
		lastUsedAt: string | null;
		isRevoked: boolean;
		permissions: TeamApiKeyPermission[];
		limits: { teams: number | null; folders: number | null; files: number | null };
	};

	type Member = {
		userId: string;
		role: TeamRole;
		name: string;
		email: string;
	};

	type PendingInvite = {
		id: string;
		email: string;
		status: string;
	};

	let members = $state<Member[]>([]);
	let pendingInvites = $state<PendingInvite[]>([]);
	let actorRole = $state<TeamRole | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);

	let teamName = $state('');
	let savingName = $state(false);
	let deletingTeam = $state(false);
	let leavingTeam = $state(false);

	let inviteEmailDraft = $state('');
	let inviteEmails = $state<string[]>([]);
	let inviting = $state(false);

	let leaveDialog = $state<HTMLDialogElement | null>(null);
	let newOwnerUserId = $state('');

	let teamApiKeys = $state<TeamApiKeyRow[]>([]);
	let teamKeysBusy = $state(false);
	let newTeamKeyName = $state('');
	let newTeamKeyLimits = $state({ folders: '', files: '' });
	let newTeamKeyPermissions = $state<TeamApiKeyPermission[]>(['drive.read', 'drive.write']);
	let lastCreatedTeamKey = $state<string | null>(null);
	let editingTeamKeyId = $state<string | null>(null);
	let editingTeamKeyPermissions = $state<TeamApiKeyPermission[]>([]);
	let editingTeamKeyLimits = $state({ folders: '', files: '' });

	const grantablePermissions = $derived(
		actorRole ? permissionsGrantableByRole(actorRole) : []
	);

	const isOwner = $derived(actorRole === 'owner');
	const isAdmin = $derived(actorRole === 'owner' || actorRole === 'admin');
	const adminCandidates = $derived(members.filter((m) => m.role === 'admin'));
	const currentMember = $derived(members.find((m) => m.userId === currentUserId) ?? null);

	function canRemoveMember(member: Member): boolean {
		if (!actorRole || member.userId === currentUserId) return false;
		if (member.role === 'owner') return false;
		if (actorRole === 'owner') return true;
		if (actorRole === 'admin') return member.role === 'member';
		return false;
	}

	async function loadMembers() {
		loading = true;
		loadError = null;
		try {
			const r = await fetchWithSession(resolve(`/api/teams/${team.id}/members`));
			if (!r.ok) throw new Error(await r.text());
			const j = (await r.json()) as {
				members: Member[];
				pendingInvites: PendingInvite[];
				actorRole: TeamRole;
			};
			members = j.members;
			pendingInvites = j.pendingInvites;
			actorRole = j.actorRole;
			teamName = team.name;
			await loadTeamApiKeys();
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load team';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void loadMembers();
	});

	async function loadTeamApiKeys() {
		if (!isAdmin || !developerModeEnabled) return;
		const r = await fetchWithSession(resolve(`/api/teams/${team.id}/api-keys`));
		if (!r.ok) return;
		const j = (await r.json()) as { keys?: TeamApiKeyRow[] };
		teamApiKeys = j.keys ?? [];
	}

	function toggleNewPermission(perm: TeamApiKeyPermission, checked: boolean) {
		if (checked) {
			if (!newTeamKeyPermissions.includes(perm)) {
				newTeamKeyPermissions = [...newTeamKeyPermissions, perm];
			}
		} else {
			newTeamKeyPermissions = newTeamKeyPermissions.filter((p) => p !== perm);
		}
	}

	function toggleEditPermission(perm: TeamApiKeyPermission, checked: boolean) {
		if (checked) {
			if (!editingTeamKeyPermissions.includes(perm)) {
				editingTeamKeyPermissions = [...editingTeamKeyPermissions, perm];
			}
		} else {
			editingTeamKeyPermissions = editingTeamKeyPermissions.filter((p) => p !== perm);
		}
	}

	function parseOptionalLimit(raw: string, label: string): number | null {
		const t = raw.trim();
		if (!t) return null;
		const n = Number(t);
		if (!Number.isInteger(n) || n < 0) throw new Error(`${label} must be a whole number ≥ 0`);
		return n;
	}

	async function createTeamApiKey() {
		const name = newTeamKeyName.trim();
		if (!name) {
			toastService.addToast('Enter an app name for this key', StatusColorEnum.WARNING);
			return;
		}
		if (newTeamKeyPermissions.length === 0) {
			toastService.addToast('Select at least one permission', StatusColorEnum.WARNING);
			return;
		}
		teamKeysBusy = true;
		try {
			const limits = {
				folders: parseOptionalLimit(newTeamKeyLimits.folders, 'Folders'),
				files: parseOptionalLimit(newTeamKeyLimits.files, 'Files')
			};
			const r = await fetchWithSession(resolve(`/api/teams/${team.id}/api-keys`), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name,
					permissions: newTeamKeyPermissions,
					limits
				})
			});
			if (!r.ok) throw new Error((await r.text()) || r.statusText);
			const j = (await r.json()) as { key?: string };
			lastCreatedTeamKey = j.key ?? null;
			newTeamKeyName = '';
			newTeamKeyLimits = { folders: '', files: '' };
			newTeamKeyPermissions = ['drive.read', 'drive.write'];
			await loadTeamApiKeys();
			toastService.addToast('Team API key created — copy it now', StatusColorEnum.SUCCESS);
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Could not create key',
				StatusColorEnum.ERROR
			);
		} finally {
			teamKeysBusy = false;
		}
	}

	function startEditTeamKey(key: TeamApiKeyRow) {
		editingTeamKeyId = key.id;
		editingTeamKeyPermissions = [...key.permissions];
		editingTeamKeyLimits = {
			folders: key.limits.folders === null ? '' : String(key.limits.folders),
			files: key.limits.files === null ? '' : String(key.limits.files)
		};
	}

	async function saveTeamKeyEdits(id: string) {
		teamKeysBusy = true;
		try {
			const limits = {
				folders: parseOptionalLimit(editingTeamKeyLimits.folders, 'Folders'),
				files: parseOptionalLimit(editingTeamKeyLimits.files, 'Files')
			};
			const r = await fetchWithSession(resolve(`/api/teams/${team.id}/api-keys/${id}`), {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ permissions: editingTeamKeyPermissions, limits })
			});
			if (!r.ok) throw new Error((await r.text()) || r.statusText);
			editingTeamKeyId = null;
			await loadTeamApiKeys();
			toastService.addToast('Key updated', StatusColorEnum.SUCCESS);
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Could not update key',
				StatusColorEnum.ERROR
			);
		} finally {
			teamKeysBusy = false;
		}
	}

	async function revokeTeamApiKey(id: string) {
		if (!confirm('Revoke this team API key? Apps using it will stop working.')) return;
		teamKeysBusy = true;
		try {
			const r = await fetchWithSession(resolve(`/api/teams/${team.id}/api-keys/${id}`), {
				method: 'DELETE'
			});
			if (!r.ok) throw new Error((await r.text()) || r.statusText);
			await loadTeamApiKeys();
			toastService.addToast('Key revoked', StatusColorEnum.INFO);
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Could not revoke key',
				StatusColorEnum.ERROR
			);
		} finally {
			teamKeysBusy = false;
		}
	}

	function addInviteEmailChip() {
		const raw = inviteEmailDraft.trim();
		if (!raw) return;
		const parts = raw
			.split(/[\s,;]+/)
			.map((s) => s.trim())
			.filter(Boolean);
		const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		for (const p of parts) {
			if (!re.test(p)) {
				toastService.addToast(`Invalid email: ${p}`, StatusColorEnum.WARNING);
				continue;
			}
			const lower = p.toLowerCase();
			if (!inviteEmails.includes(lower)) inviteEmails = [...inviteEmails, lower];
		}
		inviteEmailDraft = '';
	}

	function removeInviteEmail(email: string) {
		inviteEmails = inviteEmails.filter((e) => e !== email);
	}

	async function saveTeamName() {
		const name = teamName.trim();
		if (!name) {
			toastService.addToast('Enter a team name', StatusColorEnum.WARNING);
			return;
		}
		savingName = true;
		try {
			const r = await fetchWithSession(resolve(`/api/teams/${team.id}`), {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name })
			});
			if (!r.ok) throw new Error(await r.text());
			const j = (await r.json()) as { slug?: string };
			toastService.addToast('Team renamed', StatusColorEnum.SUCCESS);
			bumpDriveListRefresh();
			if (j.slug && j.slug !== team.slug) {
				await goto(resolveHref(`/home/team/${j.slug}/settings`));
			} else {
				await loadMembers();
			}
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Rename failed',
				StatusColorEnum.ERROR
			);
		} finally {
			savingName = false;
		}
	}

	async function submitInvites() {
		addInviteEmailChip();
		if (inviteEmails.length === 0) {
			toastService.addToast('Add at least one email', StatusColorEnum.WARNING);
			return;
		}
		inviting = true;
		try {
			const r = await fetchWithSession(resolve(`/api/teams/${team.id}/invites`), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ inviteEmails })
			});
			if (!r.ok) throw new Error(await r.text());
			const j = (await r.json()) as { addedMembers?: number; pendingInvites?: number };
			const extra: string[] = [];
			if (j.addedMembers) extra.push(`${j.addedMembers} member(s) added`);
			if (j.pendingInvites) extra.push(`${j.pendingInvites} invite(s) pending`);
			toastService.addToast(
				extra.length ? `Invites sent — ${extra.join('; ')}` : 'No new invites',
				extra.length ? StatusColorEnum.SUCCESS : StatusColorEnum.INFO
			);
			inviteEmails = [];
			inviteEmailDraft = '';
			await loadMembers();
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Invite failed',
				StatusColorEnum.ERROR
			);
		} finally {
			inviting = false;
		}
	}

	async function updateMemberRole(userId: string, role: 'admin' | 'member', label: string) {
		try {
			const r = await fetchWithSession(resolve(`/api/teams/${team.id}/members/${userId}`), {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ role })
			});
			if (!r.ok) throw new Error(await r.text());
			toastService.addToast(`${label} updated`, StatusColorEnum.SUCCESS);
			await loadMembers();
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Role update failed',
				StatusColorEnum.ERROR
			);
		}
	}

	async function removeMember(userId: string, label: string) {
		if (!confirm(`Remove ${label} from this team?`)) return;
		try {
			const r = await fetchWithSession(resolve(`/api/teams/${team.id}/members/${userId}`), {
				method: 'DELETE'
			});
			if (!r.ok) throw new Error(await r.text());
			toastService.addToast('Member removed', StatusColorEnum.SUCCESS);
			await loadMembers();
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Remove failed',
				StatusColorEnum.ERROR
			);
		}
	}

	function openLeaveDialog() {
		if (isOwner) {
			newOwnerUserId = adminCandidates[0]?.userId ?? '';
			leaveDialog?.showModal();
			return;
		}
		void leaveTeam();
	}

	async function leaveTeam() {
		leavingTeam = true;
		try {
			const body =
				isOwner && newOwnerUserId ? { newOwnerUserId } : {};
			const r = await fetchWithSession(resolve(`/api/teams/${team.id}/leave`), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!r.ok) throw new Error(await r.text());
			toastService.addToast('You left the team', StatusColorEnum.SUCCESS);
			leaveDialog?.close();
			bumpDriveListRefresh();
			await goto(resolve('/home'));
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Leave failed',
				StatusColorEnum.ERROR
			);
		} finally {
			leavingTeam = false;
		}
	}

	async function cancelInvite(inviteId: string, email: string) {
		if (!confirm(`Cancel invite for ${email}?`)) return;
		try {
			const r = await fetchWithSession(resolve(`/api/teams/${team.id}/invites/${inviteId}`), {
				method: 'DELETE'
			});
			if (!r.ok) throw new Error(await r.text());
			toastService.addToast('Invite cancelled', StatusColorEnum.SUCCESS);
			await loadMembers();
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Cancel failed',
				StatusColorEnum.ERROR
			);
		}
	}

	async function deleteTeam() {
		if (
			!confirm(
				`Delete team "${team.name}" permanently? This removes all files, shares, members, and invites.`
			)
		) {
			return;
		}
		deletingTeam = true;
		try {
			const r = await fetchWithSession(resolve(`/api/teams/${team.id}`), { method: 'DELETE' });
			if (!r.ok) throw new Error(await r.text());
			toastService.addToast('Team deleted', StatusColorEnum.SUCCESS);
			bumpDriveListRefresh();
			await goto(resolve('/home'));
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Delete failed',
				StatusColorEnum.ERROR
			);
		} finally {
			deletingTeam = false;
		}
	}
</script>

<div class="flex flex-col gap-6 pb-12">
	<div class="flex items-center gap-2">
		<LucideSettings class="size-5 text-primary" aria-hidden="true" />
		<h1 class="text-xl font-semibold">Team settings</h1>
	</div>

	{#if loading}
		<p class="text-base-content/70">Loading…</p>
	{:else if loadError}
		<p class="text-error">{loadError}</p>
	{:else}
		<section class="rounded-box border border-base-300 bg-base-100 p-4">
			<h2 class="mb-3 font-medium">Team name</h2>
			{#if isAdmin}
				<div class="flex flex-wrap items-end gap-2">
					<label class="d-form-control min-w-[16rem] flex-1">
						<span class="d-label-text">Name</span>
						<input class="d-input d-input-bordered w-full" bind:value={teamName} maxlength="200" />
					</label>
					<button
						type="button"
						class="d-btn d-btn-primary"
						disabled={savingName}
						onclick={saveTeamName}
					>
						{savingName ? 'Saving…' : 'Save'}
					</button>
				</div>
			{:else}
				<p class="text-base-content/80">{team.name}</p>
				<p class="mt-1 text-sm text-base-content/60">Only owners and admins can rename the team.</p>
			{/if}
		</section>

		<section class="rounded-box border border-base-300 bg-base-100 p-4">
			<h2 class="mb-3 font-medium">Members ({members.length})</h2>
			<ul class="divide-y divide-base-200">
				{#each members as member (member.userId)}
					<li class="flex flex-wrap items-center justify-between gap-3 py-3">
						<div>
							<p class="font-medium">{member.name}</p>
							<p class="text-sm text-base-content/60">{member.email}</p>
						</div>
						<div class="flex flex-wrap items-center gap-2">
							<span class="d-badge d-badge-outline d-badge-sm">{teamRoleLabel(member.role)}</span>
							{#if isOwner && member.role === 'member'}
								<button
									type="button"
									class="d-btn d-btn-ghost d-btn-xs"
									onclick={() => updateMemberRole(member.userId, 'admin', member.name)}
								>
									Make admin
								</button>
							{:else if isOwner && member.role === 'admin'}
								<button
									type="button"
									class="d-btn d-btn-ghost d-btn-xs"
									onclick={() => updateMemberRole(member.userId, 'member', member.name)}
								>
									Remove admin
								</button>
							{/if}
							{#if canRemoveMember(member)}
								<button
									type="button"
									class="d-btn d-btn-ghost d-btn-sm d-btn-square text-error"
									aria-label="Remove {member.name}"
									onclick={() => removeMember(member.userId, member.name)}
								>
									<LucideUserMinus class="size-4" />
								</button>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</section>

		{#if pendingInvites.length > 0}
			<section class="rounded-box border border-base-300 bg-base-100 p-4">
				<h2 class="mb-3 font-medium">Pending invites</h2>
				<ul class="divide-y divide-base-200">
					{#each pendingInvites as invite (invite.id)}
						<li class="flex flex-wrap items-center justify-between gap-2 py-3">
							<span>{invite.email}</span>
							{#if isAdmin}
								<button
									type="button"
									class="d-btn d-btn-ghost d-btn-sm"
									onclick={() => cancelInvite(invite.id, invite.email)}
								>
									Cancel
								</button>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section class="rounded-box border border-base-300 bg-base-100 p-4">
			<h2 class="mb-3 font-medium">Invite people</h2>
			<div class="flex flex-wrap gap-2">
				{#each inviteEmails as em (em)}
					<span class="d-badge d-badge-lg gap-1">
						{em}
						<button
							type="button"
							class="opacity-70 hover:opacity-100"
							aria-label="Remove {em}"
							onclick={() => removeInviteEmail(em)}>×</button
						>
					</span>
				{/each}
			</div>
			<div class="mt-3 flex flex-wrap gap-2">
				<input
					class="d-input d-input-bordered min-w-[14rem] flex-1"
					placeholder="email@company.com"
					bind:value={inviteEmailDraft}
					onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addInviteEmailChip())}
				/>
				<button type="button" class="d-btn d-btn-ghost" onclick={addInviteEmailChip}>Add</button>
				<button
					type="button"
					class="d-btn d-btn-secondary"
					disabled={inviting}
					onclick={submitInvites}
				>
					<LucideUserPlus class="size-4" />
					{inviting ? 'Sending…' : 'Send invites'}
				</button>
			</div>
		</section>

		{#if isAdmin}
			<section class="rounded-box border border-base-300 bg-base-100 p-4">
				<div class="mb-3 flex items-center gap-2">
					<LucideKey class="size-4 text-primary" aria-hidden="true" />
					<h2 class="font-medium">Developer API</h2>
				</div>
				{#if !developerModeEnabled}
					<p class="text-sm text-base-content/70">
						Enable <strong>Developer mode</strong> in Profile to create team-scoped API keys
						(<code class="rounded bg-base-300/50 px-1">znltv_…</code>). Keys only access this team.
					</p>
				{:else}
					<p class="mb-4 text-sm text-base-content/70">
						Create keys for automation scoped to <strong>{team.name}</strong>. Choose permissions per
						key; they cannot access your personal drive or other teams.
					</p>

					{#if lastCreatedTeamKey}
						<div class="d-alert d-alert-warning mb-4">
							<div class="w-full min-w-0">
								<p class="font-medium">New team key (copy once)</p>
								<input
									type="text"
									readonly
									class="d-input-bordered d-input d-input-sm mt-2 w-full font-mono text-xs"
									value={lastCreatedTeamKey}
								/>
							</div>
						</div>
					{/if}

					<div class="d-form-control mb-4 max-w-md">
						<span class="d-label-text">App name</span>
						<input
							class="d-input-bordered d-input d-input-sm mt-1"
							placeholder="e.g. nightly backup"
							bind:value={newTeamKeyName}
							disabled={teamKeysBusy}
						/>
					</div>

					<div class="mb-4 space-y-3">
						{#each TEAM_API_KEY_PERMISSION_GROUPS as group (group.title)}
							<fieldset class="rounded-box border border-base-200 p-3">
								<legend class="px-1 text-sm font-medium">{group.title}</legend>
								<div class="mt-2 grid gap-2 sm:grid-cols-2">
									{#each group.permissions as perm (perm)}
										{#if grantablePermissions.includes(perm)}
											<label class="flex cursor-pointer items-center gap-2 text-sm">
												<input
													type="checkbox"
													class="d-checkbox d-checkbox-sm"
													checked={newTeamKeyPermissions.includes(perm)}
													disabled={teamKeysBusy}
													onchange={(e) =>
														toggleNewPermission(
															perm,
															(e.currentTarget as HTMLInputElement).checked
														)}
												/>
												{perm}
											</label>
										{/if}
									{/each}
								</div>
							</fieldset>
						{/each}
					</div>

					<div class="mb-4 grid max-w-md gap-3 sm:grid-cols-2">
						<label class="d-form-control">
							<span class="d-label-text text-xs">Max folders (optional)</span>
							<input
								type="number"
								min="0"
								class="d-input-bordered d-input d-input-sm"
								placeholder="Unlimited"
								bind:value={newTeamKeyLimits.folders}
								disabled={teamKeysBusy}
							/>
						</label>
						<label class="d-form-control">
							<span class="d-label-text text-xs">Max files (optional)</span>
							<input
								type="number"
								min="0"
								class="d-input-bordered d-input d-input-sm"
								placeholder="Unlimited"
								bind:value={newTeamKeyLimits.files}
								disabled={teamKeysBusy}
							/>
						</label>
					</div>

					<button
						type="button"
						class="d-btn d-btn-primary d-btn-sm mb-6"
						disabled={teamKeysBusy || !newTeamKeyName.trim()}
						onclick={() => void createTeamApiKey()}
					>
						Generate team key
					</button>

					<h3 class="mb-2 text-sm font-semibold">Team API keys</h3>
					{#if teamApiKeys.length === 0}
						<p class="text-sm text-base-content/60">No team keys yet.</p>
					{:else}
						<ul class="divide-y divide-base-200 rounded-box border border-base-200">
							{#each teamApiKeys as k (k.id)}
								<li class="px-3 py-3">
									<div class="flex flex-wrap items-start justify-between gap-2">
										<div class="min-w-0">
											<p class="font-medium">{k.name}</p>
											<p class="font-mono text-xs text-base-content/60">{k.masked}</p>
											<p class="mt-1 text-[11px] text-base-content/60">
												{formatTeamApiKeyPermissionsSummary(k.permissions)}
											</p>
										</div>
										<div class="flex gap-1">
											<button
												type="button"
												class="d-btn d-btn-ghost d-btn-xs"
												disabled={teamKeysBusy}
												onclick={() => startEditTeamKey(k)}
											>
												Edit
											</button>
											<button
												type="button"
												class="d-btn d-btn-ghost d-btn-xs text-error"
												disabled={teamKeysBusy}
												onclick={() => void revokeTeamApiKey(k.id)}
											>
												Revoke
											</button>
										</div>
									</div>
									{#if editingTeamKeyId === k.id}
										<div class="mt-3 space-y-3 border-t border-base-200 pt-3">
											{#each TEAM_API_KEY_PERMISSION_GROUPS as group (group.title)}
												<div>
													<p class="mb-1 text-xs font-medium text-base-content/70">{group.title}</p>
													<div class="grid gap-2 sm:grid-cols-2">
														{#each group.permissions as perm (perm)}
															{#if grantablePermissions.includes(perm)}
																<label class="flex items-center gap-2 text-xs">
																	<input
																		type="checkbox"
																		class="d-checkbox d-checkbox-xs"
																		checked={editingTeamKeyPermissions.includes(perm)}
																		disabled={teamKeysBusy}
																		onchange={(e) =>
																			toggleEditPermission(
																				perm,
																				(e.currentTarget as HTMLInputElement).checked
																			)}
																	/>
																	{perm}
																</label>
															{/if}
														{/each}
													</div>
												</div>
											{/each}
											<div class="grid gap-2 sm:grid-cols-2">
												<input
													type="number"
													min="0"
													class="d-input-bordered d-input d-input-sm"
													placeholder="Max folders"
													bind:value={editingTeamKeyLimits.folders}
												/>
												<input
													type="number"
													min="0"
													class="d-input-bordered d-input d-input-sm"
													placeholder="Max files"
													bind:value={editingTeamKeyLimits.files}
												/>
											</div>
											<div class="flex gap-2">
												<button
													type="button"
													class="d-btn d-btn-primary d-btn-xs"
													disabled={teamKeysBusy}
													onclick={() => void saveTeamKeyEdits(k.id)}
												>
													Save
												</button>
												<button
													type="button"
													class="d-btn d-btn-ghost d-btn-xs"
													disabled={teamKeysBusy}
													onclick={() => (editingTeamKeyId = null)}
												>
													Cancel
												</button>
											</div>
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
			</section>
		{/if}

		{#if currentMember}
			<section class="rounded-box border border-base-300 bg-base-100 p-4">
				<h2 class="mb-3 font-medium">Your membership</h2>
				<p class="mb-3 text-sm text-base-content/70">
					You are a <strong>{teamRoleLabel(currentMember.role)}</strong> of this team.
				</p>
				{#if isOwner && adminCandidates.length === 0}
					<p class="mb-3 text-sm text-warning">
						Promote at least one member to admin before you can leave as owner.
					</p>
				{/if}
				<button
					type="button"
					class="d-btn d-btn-outline"
					disabled={leavingTeam || (isOwner && adminCandidates.length === 0)}
					onclick={openLeaveDialog}
				>
					<LucideLogOut class="size-4" />
					{leavingTeam ? 'Leaving…' : 'Leave team'}
				</button>
			</section>
		{/if}

		{#if isOwner}
			<section class="rounded-box border border-error/40 bg-error/5 p-4">
				<h2 class="mb-2 font-medium text-error">Danger zone</h2>
				<p class="mb-3 text-sm text-base-content/70">
					Deleting this team permanently removes all team files, shares, members, and pending
					invites.
				</p>
				<button
					type="button"
					class="d-btn d-btn-error"
					disabled={deletingTeam}
					onclick={deleteTeam}
				>
					<LucideTrash2 class="size-4" />
					{deletingTeam ? 'Deleting…' : 'Delete team'}
				</button>
			</section>
		{/if}
	{/if}
</div>

<dialog bind:this={leaveDialog} class="d-modal">
	<div class="d-modal-box max-w-md">
		<h3 class="mb-2 text-lg font-semibold">Leave team as owner</h3>
		<p class="mb-4 text-sm text-base-content/70">
			Choose an admin to become the new owner before you leave.
		</p>
		<label class="d-form-control w-full">
			<span class="d-label-text">New owner</span>
			<select class="d-select d-select-bordered w-full" bind:value={newOwnerUserId}>
				{#each adminCandidates as admin (admin.userId)}
					<option value={admin.userId}>{admin.name} ({admin.email})</option>
				{/each}
			</select>
		</label>
		<div class="d-modal-action">
			<button type="button" class="d-btn" onclick={() => leaveDialog?.close()}>Cancel</button>
			<button
				type="button"
				class="d-btn d-btn-primary"
				disabled={leavingTeam || !newOwnerUserId}
				onclick={() => leaveTeam()}
			>
				{leavingTeam ? 'Leaving…' : 'Transfer & leave'}
			</button>
		</div>
	</div>
	<form method="dialog" class="d-modal-backdrop">
		<button type="submit" aria-label="Close">close</button>
	</form>
</dialog>
