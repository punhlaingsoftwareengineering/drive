<script lang="ts">
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import SettingsSearchHighlight from '$lib/components/settings-search-highlight.svelte';
	import { appName } from '$lib/app-name';
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

	type ApiKeyRow = {
		id: string;
		name: string;
		masked: string;
		createdAt: string | null;
		lastUsedAt: string | null;
		isRevoked: boolean;
	};

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
	let newKeyName = $state('');
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

	async function refreshDeveloperPanel() {
		const r = await fetchWithSession(resolveHref('/api/developer/api-keys'));
		if (!r.ok) return;
		const j = (await r.json()) as { keys?: ApiKeyRow[] };
		apiKeys = j.keys ?? [];
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
		}
	}

	export function open() {
		queueMicrotask(() => dialogEl?.showModal());
	}

	async function copyText(text: string) {
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
			} else {
				const ta = document.createElement('textarea');
				ta.value = text;
				ta.style.position = 'fixed';
				ta.style.left = '-9999px';
				document.body.appendChild(ta);
				ta.select();
				document.execCommand('copy');
				document.body.removeChild(ta);
			}
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
			const r = await fetchWithSession(resolveHref('/api/developer/api-keys'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name })
			});
			if (!r.ok) throw new Error((await r.text()) || r.statusText);
			const j = (await r.json()) as { key?: string };
			lastCreatedKey = j.key ?? null;
			newKeyName = '';
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

							<div>
								<h4 class="mb-2 font-semibold">Your API keys</h4>
								{#if apiKeys.length === 0}
									<p class="text-sm text-base-content/60">No keys yet.</p>
								{:else}
									<ul class="divide-y divide-base-200 rounded-box border border-base-200">
										{#each apiKeys as k (k.id)}
											<li class="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
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
												</div>
												{#if !k.isRevoked}
													<button
														type="button"
														class="d-btn text-error d-btn-ghost d-btn-xs"
														disabled={devBusy}
														onclick={() => void revokeApiKey(k.id)}
													>
														Revoke
													</button>
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
