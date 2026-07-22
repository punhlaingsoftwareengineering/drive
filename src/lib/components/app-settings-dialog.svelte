<script lang="ts">
	import { browser } from '$app/environment';
	import {
		applyFont,
		applyFontScale,
		applyTheme,
		FONT_SCALE_PRESETS,
		isValidFont,
		isValidTheme,
		readStoredFontScale
	} from '$lib/client/display-preferences';
	import { getLocale, locales, setLocale } from '$lib/paraglide/runtime';
	import type { SettingsSectionId } from '$lib/user-settings/settings-sections';
	import { SETTINGS_SECTIONS } from '$lib/user-settings/settings-sections';
	import { DAISYUI_THEMES } from '$lib/user-settings/daisy-themes';
	import { UI_FONT_OPTIONS } from '$lib/user-settings/ui-fonts';
	import SettingsSearchHighlight from '$lib/components/settings-search-highlight.svelte';
	import { LucideSearch } from '@lucide/svelte';

	let dialogEl = $state<HTMLDialogElement | null>(null);

	let settingsSearch = $state('');
	let activeSection = $state<SettingsSectionId>('appearance');

	let draftTheme = $state('light');
	let draftFont = $state('roboto');
	let draftFontScale = $state(1);
	let draftLocale = $state<string>('en');

	const localeLabels: Record<string, string> = {
		en: 'English',
		my: 'Myanmar (Burmese)',
		ja: 'Japanese',
		ko: 'Korean'
	};

	const filteredSections = $derived.by(() => {
		const q = settingsSearch.trim().toLowerCase();
		if (!q) return SETTINGS_SECTIONS;
		return SETTINGS_SECTIONS.filter(
			(s) => s.title.toLowerCase().includes(q) || s.searchBlob.includes(q)
		);
	});

	/** Section shown on the right when the current pick is hidden by search. */
	const visibleActiveSection = $derived.by((): SettingsSectionId => {
		const ids = filteredSections.map((s) => s.id);
		if (ids.length === 0) return activeSection;
		if (ids.includes(activeSection)) return activeSection;
		return ids[0]!;
	});

	function syncFromDocument() {
		if (!browser) return;
		const t = document.documentElement.getAttribute('data-theme') ?? 'light';
		draftTheme = isValidTheme(t) ? t : 'light';
		const f = document.documentElement.getAttribute('data-font') ?? 'roboto';
		draftFont = isValidFont(f) ? f : 'roboto';
		draftFontScale = readStoredFontScale();
		try {
			draftLocale = getLocale();
		} catch {
			draftLocale = 'en';
		}
	}

	function onDialogToggle(e: Event) {
		const el = e.currentTarget as HTMLDialogElement;
		if (el.open) {
			syncFromDocument();
			settingsSearch = '';
			activeSection = 'appearance';
		}
	}

	export function open() {
		syncFromDocument();
		queueMicrotask(() => dialogEl?.showModal());
	}
</script>

<dialog bind:this={dialogEl} class="d-modal" ontoggle={onDialogToggle}>
	<div class="d-modal-box flex max-h-[min(90vh,44rem)] w-full max-w-4xl flex-col gap-0 p-0">
		<div class="flex shrink-0 flex-col gap-3 border-b border-base-200 p-5 pb-4">
			<h2 class="d-font-title text-lg font-bold">
				<SettingsSearchHighlight text="Settings" query={settingsSearch} />
			</h2>
			<label
				class="d-input-bordered d-input flex w-full items-center gap-2 ring-0 outline-none focus-within:ring-0 focus-within:ring-offset-0 focus-within:outline-none"
			>
				<LucideSearch class="size-4 shrink-0 text-base-content/50" aria-hidden="true" />
				<input
					type="search"
					class="grow border-0 bg-transparent ring-0 outline-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
					placeholder="Search settings…"
					autocomplete="off"
					bind:value={settingsSearch}
				/>
			</label>
		</div>

		<div class="flex min-h-[20rem] flex-1">
			<nav
				class="w-48 shrink-0 overflow-y-auto border-r border-base-200 bg-base-200/30 p-2"
				aria-label="Settings categories"
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
								<SettingsSearchHighlight text={section.title} query={settingsSearch} />
							</button>
						</li>
					{/each}
				</ul>
				{#if filteredSections.length === 0}
					<p class="px-2 py-3 text-sm text-base-content/60">
						<SettingsSearchHighlight text="No settings match your search." query={settingsSearch} />
					</p>
				{/if}
			</nav>

			<div class="min-w-0 flex-1 overflow-y-auto p-5">
				{#if filteredSections.length === 0}
					<p class="text-sm text-base-content/60">
						<SettingsSearchHighlight text="Try a different search term." query={settingsSearch} />
					</p>
				{:else if visibleActiveSection === 'appearance'}
					<h3 class="mb-4 text-base font-semibold">
						<SettingsSearchHighlight text="Appearance" query={settingsSearch} />
					</h3>
					<div class="flex max-w-xl flex-col gap-5">
						<label class="d-form-control w-full">
							<span class="d-label-text">
								<SettingsSearchHighlight text="Theme" query={settingsSearch} />
							</span>
							<select
								class="d-select-bordered d-select w-full"
								bind:value={draftTheme}
								onchange={() => applyTheme(draftTheme)}
							>
								{#each DAISYUI_THEMES as t (t)}
									<option value={t}>{t}</option>
								{/each}
							</select>
							<span class="d-label-text-alt text-base-content/60">
								<SettingsSearchHighlight
									text="DaisyUI color themes (stored in this browser)."
									query={settingsSearch}
								/>
							</span>
						</label>

						<label class="d-form-control w-full">
							<span class="d-label-text">
								<SettingsSearchHighlight text="Font" query={settingsSearch} />
							</span>
							<select
								class="d-select-bordered d-select w-full"
								bind:value={draftFont}
								onchange={() => applyFont(draftFont)}
							>
								{#each UI_FONT_OPTIONS as f (f.value)}
									<option value={f.value}>{f.label}</option>
								{/each}
							</select>
						</label>

						<label class="d-form-control w-full">
							<span class="d-label-text">
								<SettingsSearchHighlight text="Text size" query={settingsSearch} />
							</span>
							<select
								class="d-select-bordered d-select w-full"
								value={String(draftFontScale)}
								onchange={(e) => {
									const v = parseFloat((e.currentTarget as HTMLSelectElement).value);
									draftFontScale = v;
									applyFontScale(v);
								}}
							>
								{#each FONT_SCALE_PRESETS as p (p.value)}
									<option value={String(p.value)}>{p.label}</option>
								{/each}
							</select>
							<span class="d-label-text-alt text-base-content/60">
								<SettingsSearchHighlight
									text="Scales the base font size for the whole app."
									query={settingsSearch}
								/>
							</span>
						</label>
					</div>
				{:else if visibleActiveSection === 'language'}
					<h3 class="mb-4 text-base font-semibold">
						<SettingsSearchHighlight text="Language" query={settingsSearch} />
					</h3>
					<label class="d-form-control w-full max-w-xl">
						<span class="d-label-text">
							<SettingsSearchHighlight text="Interface language" query={settingsSearch} />
						</span>
						<select
							class="d-select-bordered d-select w-full"
							bind:value={draftLocale}
							onchange={() => {
								setLocale(draftLocale as (typeof locales)[number]);
							}}
						>
							{#each locales as loc (loc)}
								<option value={loc}>{localeLabels[loc] ?? loc}</option>
							{/each}
						</select>
						<span class="d-label-text-alt text-base-content/60">
							<SettingsSearchHighlight
								text="The page reloads after you change language."
								query={settingsSearch}
							/>
						</span>
					</label>
				{:else if visibleActiveSection === 'general'}
					<h3 class="mb-4 text-base font-semibold">
						<SettingsSearchHighlight text="General" query={settingsSearch} />
					</h3>
					<p class="max-w-xl text-sm leading-relaxed text-base-content/70">
						<SettingsSearchHighlight
							text="Additional preferences (notifications, defaults, and account options) can go here later."
							query={settingsSearch}
						/>
					</p>
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
