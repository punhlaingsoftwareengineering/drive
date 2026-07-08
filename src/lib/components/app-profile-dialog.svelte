<script lang="ts">
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import SettingsSearchHighlight from '$lib/components/settings-search-highlight.svelte';
	import { appName } from '$lib/app-name';
	import { copyTextToClipboard } from '$lib/client/copy-text';
	import { fetchWithSession } from '$lib/client/fetch-session';
	import { resolveHref } from '$lib/url/resolve-href';
	import { StatusColorEnum } from '$lib/model/enum/color.enum';
	import { toastService } from '$lib/service/toast.service.svelte';
	import type { ProfileSectionId } from '$lib/user-settings/profile-sections';
	import { PROFILE_SECTIONS } from '$lib/user-settings/profile-sections';
	import { LucideCopy, LucideSearch } from '@lucide/svelte';

	/** Matches session user from `+layout.server` (`locals.user`). */
	export type ProfileDialogUser = {
		id?: string;
		email?: string | null;
		name?: string | null;
	} | null;

	type ApiKeyLimits = {
		teams: number | null;
		folders: number | null;
		files: number | null;
	};

	type ApiKeyRow = {
		id: string;
		name: string;
		masked: string;
		createdAt: string | null;
		lastUsedAt: string | null;
		isRevoked: boolean;
		limits?: ApiKeyLimits;
	};

	type LimitFields = { teams: string; folders: string; files: string };

	const emptyLimitFields = (): LimitFields => ({ teams: '', folders: '', files: '' });

	let {
		user = null,
		appVersion = '0.0.1',
		developerModeEnabled = false
	}: {
		user?: ProfileDialogUser;
		appVersion?: string;
		developerModeEnabled?: boolean;
	} = $props();

	const brand = $derived(appName());
	const aboutText = $derived(
		`${brand} is your personal cloud workspace for files, sharing, and storage.`
	);
	const developerText = $derived(
		`Turn on developer mode to create API keys. Each key is tied to an app name and acts as that user for ${brand} HTTP APIs (same access as your logged-in session to your files).`
	);

	let dialogEl = $state<HTMLDialogElement | null>(null);
	let dialogIsOpen = $state(false);
	let profileSearch = $state('');
	let activeSection = $state<ProfileSectionId>('about');

	let devMode = $state(false);
	let apiKeys = $state<ApiKeyRow[]>([]);
	let serverLimits = $state<({ apiKeys: number | null } & ApiKeyLimits) | null>(null);
	let newKeyName = $state('');
	let newKeyLimits = $state<LimitFields>(emptyLimitFields());
	let editingLimitsId = $state<string | null>(null);
	let editingLimits = $state<LimitFields>(emptyLimitFields());
	let lastCreatedKey = $state<string | null>(null);
	let devBusy = $state(false);

	$effect(() => {
		devMode = developerModeEnabled;
	});

	const filteredSections = $derived.by(() => {
		const q = profileSearch.trim().toLowerCase();
		if (!q) return PROFILE_SECTIONS;
		return PROFILE_SECTIONS.filter(
			(s) => s.title.toLowerCase().includes(q) || s.searchBlob.includes(q)
		);
	});

	const visibleActiveSection = $derived.by((): ProfileSectionId => {
		const ids = filteredSections.map((s) => s.id);
		if (ids.length === 0) return activeSection;
		if (ids.includes(activeSection)) return activeSection;
		return ids[0]!;
	});

	function limitHint(kind: keyof ApiKeyLimits): string {
		const server = serverLimits?.[kind];
		return server === null || server === undefined
			? 'Blank = unlimited for this key'
			: `Blank = unlimited (server max ${server})`;
	}

	function limitsSummary(limits: ApiKeyLimits | undefined): string {
		if (!limits) return 'No per-key limits';
		const parts = [
			limits.teams === null ? 'teams: unlimited' : `teams: ${limits.teams}`,
			limits.folders === null ? 'folders: unlimited' : `folders: ${limits.folders}`,
			limits.files === null ? 'files: unlimited' : `files: ${limits.files}`
		];
		return parts.join(' · ');
	}

	function limitsFromRow(limits: ApiKeyLimits | undefined): LimitFields {
		return {
			teams: limits?.teams === null || limits?.teams === undefined ? '' : String(limits.teams),
			folders:
				limits?.folders === null || limits?.folders === undefined ? '' : String(limits.folders),
			files: limits?.files === null || limits?.files === undefined ? '' : String(limits.files)
		};
	}

	function parseLimitField(raw: string, label: string): number | null {
		const t = raw.trim();
		if (!t) return null;
		const n = Number(t);
		if (!Number.isInteger(n) || n < 0) {
			throw new Error(`${label} must be a whole number ≥ 0`);
		}
		return n;
	}

	function buildCreateLimitsPayload(fields: LimitFields): ApiKeyLimits | undefined {
		let teams: number | null | undefined;
		let folders: number | null | undefined;
		let files: number | null | undefined;
		try {
			if (fields.teams.trim()) teams = parseLimitField(fields.teams, 'Teams');
			if (fields.folders.trim()) folders = parseLimitField(fields.folders, 'Folders');
			if (fields.files.trim()) files = parseLimitField(fields.files, 'Files');
		} catch (e) {
			throw e;
		}
		if (teams === undefined && folders === undefined && files === undefined) return undefined;
		return {
			teams: teams ?? null,
			folders: folders ?? null,
			files: files ?? null
		};
	}

	function buildPatchLimitsPayload(fields: LimitFields): ApiKeyLimits {
		return {
			teams: parseLimitField(fields.teams, 'Teams'),
			folders: parseLimitField(fields.folders, 'Folders'),
			files: parseLimitField(fields.files, 'Files')
		};
	}

	async function refreshDeveloperPanel() {
		const [keysR, modeR] = await Promise.all([
			fetchWithSession(resolveHref('/api/developer/api-keys')),
			fetchWithSession(resolveHref('/api/developer/mode'))
		]);
		if (keysR.ok) {
			const j = (await keysR.json()) as { keys?: ApiKeyRow[] };
			apiKeys = j.keys ?? [];
		}
		if (modeR.ok) {
			const m = (await modeR.json()) as {
				limits?: { teams: number | null; folders: number | null; files: number | null; apiKeys: number | null };
			};
			serverLimits = m.limits ?? null;
		}
	}

	$effect(() => {
		if (!browser) return;
		if (dialogIsOpen && visibleActiveSection === 'developer') {
			void refreshDeveloperPanel();
		}
	});

	function onDialogToggle(e: Event) {
		const el = e.currentTarget as HTMLDialogElement;
		dialogIsOpen = el.open;
		if (el.open) {
			profileSearch = '';
			activeSection = 'about';
			lastCreatedKey = null;
			newKeyName = '';
			newKeyLimits = emptyLimitFields();
			editingLimitsId = null;
			editingLimits = emptyLimitFields();
		}
	}

	export function open() {
		queueMicrotask(() => dialogEl?.showModal());
	}

	async function copyText(text: string) {
		try {
			await copyTextToClipboard(text);
			toastService.addToast('Copied', StatusColorEnum.SUCCESS);
		} catch {
			toastService.addToast('Copy failed', StatusColorEnum.ERROR);
		}
	}

	async function toggleDeveloperMode(next: boolean) {
		devBusy = true;
		try {
			const r = await fetchWithSession(resolveHref('/api/developer/mode'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ enabled: next })
			});
			if (!r.ok) throw new Error((await r.text()) || r.statusText);
			devMode = next;
			await invalidateAll();
			toastService.addToast(
				next ? 'Developer mode enabled' : 'Developer mode disabled',
				StatusColorEnum.SUCCESS
			);
			await refreshDeveloperPanel();
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Could not update developer mode',
				StatusColorEnum.ERROR
			);
		} finally {
			devBusy = false;
		}
	}

	async function createApiKey() {
		const name = newKeyName.trim();
		if (!name) {
			toastService.addToast('Enter an app name for this key', StatusColorEnum.WARNING);
			return;
		}
		devBusy = true;
		try {
			let limits: ApiKeyLimits | undefined;
			try {
				limits = buildCreateLimitsPayload(newKeyLimits);
			} catch (e) {
				throw new Error(e instanceof Error ? e.message : 'Invalid limits');
			}
			const r = await fetchWithSession(resolveHref('/api/developer/api-keys'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name,
					...(limits ? { limits: { teams: limits.teams, folders: limits.folders, files: limits.files } } : {})
				})
			});
			if (!r.ok) throw new Error((await r.text()) || r.statusText);
			const j = (await r.json()) as { key?: string };
			lastCreatedKey = j.key ?? null;
			newKeyName = '';
			newKeyLimits = emptyLimitFields();
			await refreshDeveloperPanel();
			toastService.addToast('API key created — copy it now', StatusColorEnum.SUCCESS);
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Could not create key',
				StatusColorEnum.ERROR
			);
		} finally {
			devBusy = false;
		}
	}

	function startEditLimits(key: ApiKeyRow) {
		editingLimitsId = key.id;
		editingLimits = limitsFromRow(key.limits);
	}

	function cancelEditLimits() {
		editingLimitsId = null;
		editingLimits = emptyLimitFields();
	}

	async function saveKeyLimits(id: string) {
		devBusy = true;
		try {
			const limits = buildPatchLimitsPayload(editingLimits);
			const r = await fetchWithSession(resolveHref(`/api/developer/api-keys/${id}`), {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ limits })
			});
			if (!r.ok) throw new Error((await r.text()) || r.statusText);
			editingLimitsId = null;
			editingLimits = emptyLimitFields();
			await refreshDeveloperPanel();
			toastService.addToast('Key limits updated', StatusColorEnum.SUCCESS);
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Could not update limits',
				StatusColorEnum.ERROR
			);
		} finally {
			devBusy = false;
		}
	}

	async function revokeApiKey(id: string) {
		if (!confirm('Revoke this API key? Apps using it will stop working.')) return;
		devBusy = true;
		try {
			const r = await fetchWithSession(resolveHref(`/api/developer/api-keys/${id}`), {
				method: 'DELETE'
			});
			if (!r.ok) throw new Error((await r.text()) || r.statusText);
			await refreshDeveloperPanel();
			toastService.addToast('Key revoked', StatusColorEnum.INFO);
		} catch (e) {
			toastService.addToast(
				e instanceof Error ? e.message : 'Could not revoke key',
				StatusColorEnum.ERROR
			);
		} finally {
			devBusy = false;
		}
	}
</script>

<dialog bind:this={dialogEl} class="d-modal" ontoggle={onDialogToggle}>
	<div class="d-modal-box flex max-h-[min(90vh,44rem)] w-full max-w-4xl flex-col gap-0 p-0">
		<div class="flex shrink-0 flex-col gap-3 border-b border-base-200 p-5 pb-4">
			<h2 class="d-font-title text-lg font-bold">
				<SettingsSearchHighlight text="Profile" query={profileSearch} />
			</h2>
			<label
				class="d-input-bordered d-input flex w-full items-center gap-2 ring-0 outline-none focus-within:ring-0 focus-within:ring-offset-0 focus-within:outline-none"
			>
				<LucideSearch class="size-4 shrink-0 text-base-content/50" aria-hidden="true" />
				<input
					type="search"
					class="grow border-0 bg-transparent ring-0 outline-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
					placeholder="Search profile…"
					autocomplete="off"
					bind:value={profileSearch}
				/>
			</label>
		</div>

		<div class="flex min-h-[20rem] flex-1">
			<nav
				class="w-48 shrink-0 overflow-y-auto border-r border-base-200 bg-base-200/30 p-2"
				aria-label="Profile sections"
			>
				<ul class="flex flex-col gap-0.5">
					{#each filteredSections as section (section.id)}
						<li>
							<button
								type="button"
								class="d-btn w-full justify-start font-normal d-btn-ghost d-btn-sm {visibleActiveSection ===
								section.id
									? 'd-btn-active'
									: ''}"
								onclick={() => (activeSection = section.id)}
							>
								<SettingsSearchHighlight text={section.title} query={profileSearch} />
							</button>
						</li>
					{/each}
				</ul>
				{#if filteredSections.length === 0}
					<p class="px-2 py-3 text-sm text-base-content/60">
						<SettingsSearchHighlight
							text="No profile sections match your search."
							query={profileSearch}
						/>
					</p>
				{/if}
			</nav>

			<div class="min-w-0 flex-1 overflow-y-auto p-5">
				{#if filteredSections.length === 0}
					<p class="text-sm text-base-content/60">
						<SettingsSearchHighlight text="Try a different search term." query={profileSearch} />
					</p>
				{:else if visibleActiveSection === 'about'}
					<h3 class="mb-4 text-base font-semibold">
						<SettingsSearchHighlight text="About" query={profileSearch} />
					</h3>
					<div class="max-w-xl space-y-4 text-sm leading-relaxed text-base-content/80">
						<p>
							<SettingsSearchHighlight text={aboutText} query={profileSearch} />
						</p>
						<p>
							<span class="text-base-content/60">Version </span>
							<SettingsSearchHighlight text={appVersion} query={profileSearch} />
						</p>
						{#if user?.email}
							<div class="d-form-control">
								<span class="d-label-text">
									<SettingsSearchHighlight text="Signed in as" query={profileSearch} />
								</span>
								<p class="mt-1 font-mono text-sm">
									<SettingsSearchHighlight text={user.email} query={profileSearch} />
								</p>
							</div>
						{/if}
						{#if user?.name}
							<div class="d-form-control">
								<span class="d-label-text">
									<SettingsSearchHighlight text="Display name" query={profileSearch} />
								</span>
								<p class="mt-1 text-sm">
									<SettingsSearchHighlight text={user.name} query={profileSearch} />
								</p>
							</div>
						{/if}
					</div>
				{:else if visibleActiveSection === 'developer'}
					<h3 class="mb-4 text-base font-semibold">
						<SettingsSearchHighlight text="Developer" query={profileSearch} />
					</h3>
					<div class="max-w-2xl space-y-5 text-sm leading-relaxed">
						<p class="text-base-content/80">
							<SettingsSearchHighlight text={developerText} query={profileSearch} />
						</p>

						<div class="flex flex-wrap items-center gap-3">
							<span class="font-medium text-base-content/70">Developer mode</span>
							<input
								type="checkbox"
								class="d-toggle d-toggle-primary d-toggle-sm"
								checked={devMode}
								disabled={devBusy}
								onchange={(e) =>
									void toggleDeveloperMode((e.currentTarget as HTMLInputElement).checked)}
							/>
						</div>

						{#if devMode}
							<div class="rounded-box border border-base-200 bg-base-200/20 p-4">
								<h4 class="mb-2 font-semibold">Using a key</h4>
								<p class="mb-2 text-xs text-base-content/70">
									Send the full key in
									<code class="rounded bg-base-300/50 px-1">Authorization: Bearer &lt;key&gt;</code>
									or
									<code class="rounded bg-base-300/50 px-1">X-API-Key: &lt;key&gt;</code>.
								</p>
								<p class="text-xs text-base-content/60">
									Prefix
									<code class="rounded bg-base-300/50 px-1">znldv_</code>
									— keep keys secret; anyone with the key can access your account via the API while developer
									mode stays on.
								</p>
							</div>

							{#if lastCreatedKey}
								<div class="d-alert d-alert-warning">
									<div class="w-full min-w-0">
										<p class="font-medium">New key (copy once)</p>
										<input
											type="text"
											readonly
											class="d-input-bordered d-input d-input-sm mt-2 w-full font-mono text-xs"
											value={lastCreatedKey}
										/>
										<button
											type="button"
											class="d-btn mt-2 gap-2 d-btn-ghost d-btn-sm"
											onclick={() => void copyText(lastCreatedKey!)}
										>
											<LucideCopy class="size-4" aria-hidden="true" />
											Copy key
										</button>
									</div>
								</div>
							{/if}

							<div class="d-form-control w-full max-w-md">
								<span class="d-label-text">App name</span>
								<div class="mt-1 flex flex-col gap-2 sm:flex-row">
									<input
										type="text"
										class="d-input-bordered d-input d-input-sm grow"
										placeholder="e.g. CI backup script"
										bind:value={newKeyName}
										disabled={devBusy}
									/>
									<button
										type="button"
										class="d-btn shrink-0 d-btn-sm d-btn-primary"
										disabled={devBusy || !newKeyName.trim()}
										onclick={() => void createApiKey()}
									>
										Generate key
									</button>
								</div>
							</div>

							<fieldset class="d-fieldset max-w-md rounded-box border border-base-200 p-4">
								<legend class="d-fieldset-legend px-1 text-sm font-medium">
									Per-key limits (optional)
								</legend>
								<p class="mb-3 text-xs text-base-content/60">
									Cap what this key can create via the API. Server-wide env limits still apply to your
									account.
								</p>
								<div class="grid gap-3 sm:grid-cols-3">
									<label class="d-form-control">
										<span class="d-label-text text-xs">Max teams</span>
										<input
											type="number"
											min="0"
											step="1"
											class="d-input-bordered d-input d-input-sm"
											placeholder="Unlimited"
											bind:value={newKeyLimits.teams}
											disabled={devBusy}
										/>
										<span class="d-label-text-alt text-[11px]">{limitHint('teams')}</span>
									</label>
									<label class="d-form-control">
										<span class="d-label-text text-xs">Max folders</span>
										<input
											type="number"
											min="0"
											step="1"
											class="d-input-bordered d-input d-input-sm"
											placeholder="Unlimited"
											bind:value={newKeyLimits.folders}
											disabled={devBusy}
										/>
										<span class="d-label-text-alt text-[11px]">{limitHint('folders')}</span>
									</label>
									<label class="d-form-control">
										<span class="d-label-text text-xs">Max files</span>
										<input
											type="number"
											min="0"
											step="1"
											class="d-input-bordered d-input d-input-sm"
											placeholder="Unlimited"
											bind:value={newKeyLimits.files}
											disabled={devBusy}
										/>
										<span class="d-label-text-alt text-[11px]">{limitHint('files')}</span>
									</label>
								</div>
							</fieldset>

							<div>
								<h4 class="mb-2 font-semibold">Your API keys</h4>
								{#if apiKeys.length === 0}
									<p class="text-sm text-base-content/60">No keys yet.</p>
								{:else}
									<ul class="divide-y divide-base-200 rounded-box border border-base-200">
										{#each apiKeys as k (k.id)}
											<li class="px-3 py-2">
												<div class="flex flex-wrap items-center justify-between gap-2">
													<div class="min-w-0">
														<p class="font-medium">{k.name}</p>
														<p class="font-mono text-xs text-base-content/60">{k.masked}</p>
														<p class="text-[11px] text-base-content/50">
															{#if k.isRevoked}
																Revoked
															{:else if k.lastUsedAt}
																Last used {new Date(k.lastUsedAt).toLocaleString()}
															{:else}
																Never used
															{/if}
														</p>
														{#if !k.isRevoked}
															<p class="mt-1 text-[11px] text-base-content/60">
																{limitsSummary(k.limits)}
															</p>
														{/if}
													</div>
													{#if !k.isRevoked}
														<div class="flex flex-wrap gap-1">
															<button
																type="button"
																class="d-btn d-btn-ghost d-btn-xs"
																disabled={devBusy}
																onclick={() => startEditLimits(k)}
															>
																{editingLimitsId === k.id ? 'Editing…' : 'Limits'}
															</button>
															<button
																type="button"
																class="d-btn text-error d-btn-ghost d-btn-xs"
																disabled={devBusy}
																onclick={() => void revokeApiKey(k.id)}
															>
																Revoke
															</button>
														</div>
													{/if}
												</div>
												{#if !k.isRevoked && editingLimitsId === k.id}
													<div class="mt-3 grid gap-2 border-t border-base-200 pt-3 sm:grid-cols-3">
														<label class="d-form-control">
															<span class="d-label-text text-xs">Max teams</span>
															<input
																type="number"
																min="0"
																step="1"
																class="d-input-bordered d-input d-input-sm"
																placeholder="Unlimited"
																bind:value={editingLimits.teams}
																disabled={devBusy}
															/>
														</label>
														<label class="d-form-control">
															<span class="d-label-text text-xs">Max folders</span>
															<input
																type="number"
																min="0"
																step="1"
																class="d-input-bordered d-input d-input-sm"
																placeholder="Unlimited"
																bind:value={editingLimits.folders}
																disabled={devBusy}
															/>
														</label>
														<label class="d-form-control">
															<span class="d-label-text text-xs">Max files</span>
															<input
																type="number"
																min="0"
																step="1"
																class="d-input-bordered d-input d-input-sm"
																placeholder="Unlimited"
																bind:value={editingLimits.files}
																disabled={devBusy}
															/>
														</label>
													</div>
													<div class="mt-2 flex gap-2">
														<button
															type="button"
															class="d-btn d-btn-primary d-btn-xs"
															disabled={devBusy}
															onclick={() => void saveKeyLimits(k.id)}
														>
															Save limits
														</button>
														<button
															type="button"
															class="d-btn d-btn-ghost d-btn-xs"
															disabled={devBusy}
															onclick={cancelEditLimits}
														>
															Cancel
														</button>
													</div>
												{/if}
											</li>
										{/each}
									</ul>
								{/if}
							</div>
						{:else}
							<p class="text-sm text-base-content/60">
								Enable developer mode to generate API keys and integrate with scripts or other apps.
							</p>
						{/if}

						<div class="border-t border-base-200 pt-4 text-xs text-base-content/70">
							<p class="mb-1">
								<span class="font-medium">Stack:</span>
								SvelteKit, Svelte 5, Tailwind, DaisyUI ·
								<SettingsSearchHighlight text={import.meta.env.MODE} query={profileSearch} />
							</p>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div class="d-modal-action shrink-0 border-t border-base-200 p-4">
			<form method="dialog">
				<button type="submit" class="d-btn">Close</button>
			</form>
		</div>
	</div>
</dialog>
