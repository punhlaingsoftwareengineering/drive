<script lang="ts">
	import { browser } from '$app/environment';
	import { fetchWithSession } from '$lib/client/fetch-session';
	import { resolveHref } from '$lib/url/resolve-href';
	import { formatBytes } from '$lib/tool/format-bytes';
	import type { StorageProviderId } from '$lib/model/storage-provider';
	import { storageProviderLabel } from '$lib/model/storage-provider';
	import { registerDriveListReload } from '$lib/state/drive-refresh.svelte';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const team = $derived(data.teamView);
	const teamStorage = $derived(team?.storageProvider ?? 'local');

	type D3Module = typeof import('d3');

	type StatsPayload = {
		storageProvider: StorageProviderId;
		summary: {
			files: number;
			folders: number;
			totalBytes: number;
			trashedFiles: number;
			trashedBytes: number;
			activeShares: number;
			pinnedFiles: number;
			starredFiles: number;
		};
		byCategory: Array<{ category: string; files: number; bytes: number }>;
		activityByWeek: Array<{ weekStart: string; fileCount: number }>;
	};

	let stats = $state<StatsPayload | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);

	let pieEl = $state<HTMLDivElement | null>(null);
	let barEl = $state<HTMLDivElement | null>(null);
	let lineEl = $state<HTMLDivElement | null>(null);

	let d3Api = $state<D3Module | null>(null);

	const palette = $derived(d3Api?.schemeTableau10 ?? d3Api?.schemeCategory10 ?? []);

	function drawStoragePie(el: HTMLElement, rows: StatsPayload['byCategory'], totalBytes: number) {
		const d3 = d3Api;
		if (!d3) return;
		d3.select(el).selectAll('*').remove();
		const w = Math.max(el.clientWidth, 280);
		const h = Math.min(320, Math.max(240, w * 0.55));
		const radius = Math.min(w, h) / 2 - 12;

		if (totalBytes <= 0 || !rows.length) {
			d3.select(el)
				.append('p')
				.attr('class', 'text-base-content/60 px-2 py-8 text-sm')
				.text('Upload files to see storage breakdown by type.');
			return;
		}

		const svg = d3
			.select(el)
			.append('svg')
			.attr('width', w)
			.attr('height', h)
			.attr('role', 'img')
			.attr('aria-label', 'Storage used by file category');

		const g = svg.append('g').attr('transform', `translate(${w / 2},${h / 2})`);

		const pie = d3
			.pie<{ category: string; bytes: number }>()
			.sort(null)
			.value((d) => d.bytes);

		const arc = d3
			.arc<d3.PieArcDatum<{ category: string; bytes: number }>>()
			.innerRadius(radius * 0.52)
			.outerRadius(radius);

		const arcs = g.selectAll('path').data(pie(rows)).join('path');

		arcs
			.attr('fill', (_, i) => palette[i % palette.length] ?? '#888')
			.attr('d', arc)
			.attr('stroke', 'var(--color-base-100)')
			.attr('stroke-width', 1);

		arcs
			.append('title')
			.text(
				(d) =>
					`${d.data.category}: ${formatBytes(d.data.bytes)} (${((100 * d.data.bytes) / totalBytes).toFixed(1)}%)`
			);

		const legend = d3
			.select(el)
			.append('div')
			.attr('class', 'mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 px-2 text-xs');

		rows.forEach((row, i) => {
			const pct = ((100 * row.bytes) / totalBytes).toFixed(1);
			legend
				.append('span')
				.attr('class', 'inline-flex items-center gap-1.5')
				.html(
					`<span class="inline-block size-2.5 shrink-0 rounded-sm" style="background:${palette[i % palette.length]}"></span><span>${row.category}</span><span class="text-base-content/60">${pct}%</span>`
				);
		});
	}

	function drawFilesBar(el: HTMLElement, rows: StatsPayload['byCategory']) {
		const d3 = d3Api;
		if (!d3) return;
		d3.select(el).selectAll('*').remove();
		const w = Math.max(el.clientWidth, 280);
		const rowH = 28;
		const margin = { top: 8, right: 16, bottom: 8, left: 120 };
		const innerW = w - margin.left - margin.right;
		const innerH = Math.max(rows.length * rowH, 120);
		const h = innerH + margin.top + margin.bottom;

		if (!rows.length) {
			d3.select(el)
				.append('p')
				.attr('class', 'text-base-content/60 px-2 py-8 text-sm')
				.text('No file count breakdown yet.');
			return;
		}

		const maxFiles = d3.max(rows, (d) => d.files) ?? 1;
		const x = d3.scaleLinear().domain([0, maxFiles]).nice().range([0, innerW]);
		const y = d3
			.scaleBand()
			.domain(rows.map((d) => d.category))
			.range([0, innerH])
			.padding(0.25);

		const svg = d3
			.select(el)
			.append('svg')
			.attr('width', w)
			.attr('height', h)
			.attr('role', 'img')
			.attr('aria-label', 'File count by category');

		const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

		g.selectAll('rect')
			.data(rows)
			.join('rect')
			.attr('x', 0)
			.attr('y', (d) => y(d.category) ?? 0)
			.attr('height', y.bandwidth())
			.attr('width', (d) => x(d.files))
			.attr('fill', (_, i) => palette[i % palette.length] ?? '#888')
			.attr('rx', 4);

		g.selectAll('text.label')
			.data(rows)
			.join('text')
			.attr('class', 'label')
			.attr('x', -8)
			.attr('y', (d) => (y(d.category) ?? 0) + y.bandwidth() / 2)
			.attr('dy', '0.35em')
			.attr('text-anchor', 'end')
			.attr('fill', 'currentColor')
			.attr('font-size', 12)
			.text((d) => d.category);

		g.selectAll('text.value')
			.data(rows)
			.join('text')
			.attr('class', 'value')
			.attr('x', (d) => x(d.files) + 6)
			.attr('y', (d) => (y(d.category) ?? 0) + y.bandwidth() / 2)
			.attr('dy', '0.35em')
			.attr('fill', 'currentColor')
			.attr('font-size', 12)
			.text((d) => d.files);
	}

	function drawActivityLine(el: HTMLElement, weeks: StatsPayload['activityByWeek']) {
		const d3 = d3Api;
		if (!d3) return;
		d3.select(el).selectAll('*').remove();
		const w = Math.max(el.clientWidth, 280);
		const h = 260;
		const margin = { top: 20, right: 16, bottom: 36, left: 36 };
		const innerW = w - margin.left - margin.right;
		const innerH = h - margin.top - margin.bottom;

		if (!weeks.length) {
			d3.select(el)
				.append('p')
				.attr('class', 'text-base-content/60 px-2 py-8 text-sm')
				.text('No weekly activity yet.');
			return;
		}

		const maxY = d3.max(weeks, (d) => d.fileCount) ?? 1;
		const x = d3
			.scalePoint<string>()
			.domain(weeks.map((d) => d.weekStart))
			.range([0, innerW])
			.padding(0.5);

		const y = d3.scaleLinear().domain([0, maxY]).nice().range([innerH, 0]);

		const line = d3
			.line<(typeof weeks)[number]>()
			.x((d) => x(d.weekStart) ?? 0)
			.y((d) => y(d.fileCount))
			.curve(d3.curveMonotoneX);

		const svg = d3
			.select(el)
			.append('svg')
			.attr('width', w)
			.attr('height', h)
			.attr('role', 'img')
			.attr('aria-label', 'Files touched per week by last modified date');

		const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

		g.append('path')
			.datum(weeks)
			.attr('fill', 'none')
			.attr('stroke', 'var(--color-primary)')
			.attr('stroke-width', 2)
			.attr('d', line);

		g.selectAll('circle')
			.data(weeks)
			.join('circle')
			.attr('cx', (d) => x(d.weekStart) ?? 0)
			.attr('cy', (d) => y(d.fileCount))
			.attr('r', 4)
			.attr('fill', 'var(--color-primary)');

		const xAxis = d3.axisBottom(x).tickFormat((d) => {
			const dt = new Date(d + 'T12:00:00Z');
			return d3.utcFormat('%b %d')(dt);
		});

		g.append('g')
			.attr('transform', `translate(0,${innerH})`)
			.call(xAxis)
			.selectAll('text')
			.attr('transform', 'rotate(-35)')
			.style('text-anchor', 'end')
			.attr('font-size', 10);

		g.append('g')
			.call(d3.axisLeft(y).ticks(5).tickSizeOuter(0))
			.selectAll('text')
			.attr('font-size', 10);

		g.append('text')
			.attr('x', innerW / 2)
			.attr('y', -6)
			.attr('text-anchor', 'middle')
			.attr('fill', 'currentColor')
			.attr('font-size', 11)
			.attr('opacity', 0.7)
			.text('Active files per week (by last modified)');
	}

	function redrawCharts(s: StatsPayload) {
		if (!d3Api) return;
		if (pieEl) drawStoragePie(pieEl, s.byCategory, s.summary.totalBytes);
		if (barEl) drawFilesBar(barEl, s.byCategory);
		if (lineEl) drawActivityLine(lineEl, s.activityByWeek);
	}

	let statsLoadSeq = 0;

	async function loadStats() {
		if (!browser || !team) return;
		const seq = ++statsLoadSeq;
		loading = true;
		loadError = null;
		try {
			const qs = new URLSearchParams({
				storageProvider: teamStorage,
				teamId: team.id
			});
			const r = await fetchWithSession(`${resolveHref('/api/drive/stats')}?${qs}`);
			if (!r.ok) throw new Error((await r.text()) || r.statusText);
			const payload = (await r.json()) as StatsPayload;
			if (seq === statsLoadSeq) {
				stats = payload;
			}
		} catch (e) {
			if (seq === statsLoadSeq) {
				loadError = e instanceof Error ? e.message : 'Failed to load dashboard';
				stats = null;
			}
		} finally {
			if (seq === statsLoadSeq) {
				loading = false;
			}
		}
	}

	onMount(() => {
		void import('d3').then((mod) => {
			d3Api = mod;
		});
		void loadStats();
		return registerDriveListReload(() => void loadStats());
	});

	$effect(() => {
		if (!browser || !stats || !pieEl || !barEl || !lineEl || !d3Api) return;

		const run = () => redrawCharts(stats!);

		run();
		let frame = 0;
		let debounceTimer: ReturnType<typeof setTimeout> | undefined;
		const ro = new ResizeObserver(() => {
			cancelAnimationFrame(frame);
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				frame = requestAnimationFrame(run);
			}, 150);
		});
		ro.observe(pieEl);
		ro.observe(barEl);
		ro.observe(lineEl);

		return () => {
			cancelAnimationFrame(frame);
			clearTimeout(debounceTimer);
			ro.disconnect();
		};
	});
</script>

<div class="flex min-h-0 flex-1 flex-col gap-6 pb-8">
	<div class="flex flex-col gap-1">
		<h2 class="text-xl font-bold">Team dashboard</h2>
		<p class="text-sm text-base-content/70">
			Usage stats for <strong>{team?.name ?? 'this team'}</strong> on
			<strong>{storageProviderLabel(teamStorage)}</strong>.
		</p>
	</div>

	{#if loading && !stats}
		<div class="h-40 w-full d-skeleton"></div>
	{:else if loadError}
		<div class="d-alert d-alert-error">
			<span>{loadError}</span>
		</div>
	{:else if stats}
		<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<div class="d-stats bg-base-100 shadow-sm">
				<div class="d-stat">
					<div class="d-stat-title">Files</div>
					<div class="d-stat-value text-primary">{stats.summary.files}</div>
					<div class="d-stat-desc">Not in trash</div>
				</div>
			</div>
			<div class="d-stats bg-base-100 shadow-sm">
				<div class="d-stat">
					<div class="d-stat-title">Folders</div>
					<div class="d-stat-value text-secondary">{stats.summary.folders}</div>
					<div class="d-stat-desc">Active tree</div>
				</div>
			</div>
			<div class="d-stats bg-base-100 shadow-sm">
				<div class="d-stat">
					<div class="d-stat-title">Storage used</div>
					<div class="d-stat-value text-lg text-accent sm:text-2xl">
						{formatBytes(stats.summary.totalBytes)}
					</div>
					<div class="d-stat-desc">All active files</div>
				</div>
			</div>
			<div class="d-stats bg-base-100 shadow-sm">
				<div class="d-stat">
					<div class="d-stat-title">Outgoing shares</div>
					<div class="d-stat-value text-info">{stats.summary.activeShares}</div>
					<div class="d-stat-desc">Active files shared</div>
				</div>
			</div>
		</div>

		<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<div class="d-stats bg-base-100 shadow-sm">
				<div class="d-stat">
					<div class="d-stat-title">In trash</div>
					<div class="d-stat-value">{stats.summary.trashedFiles}</div>
					<div class="d-stat-desc">{formatBytes(stats.summary.trashedBytes)}</div>
				</div>
			</div>
			<div class="d-stats bg-base-100 shadow-sm">
				<div class="d-stat">
					<div class="d-stat-title">Pinned</div>
					<div class="d-stat-value">{stats.summary.pinnedFiles}</div>
					<div class="d-stat-desc">Files</div>
				</div>
			</div>
			<div class="d-stats bg-base-100 shadow-sm">
				<div class="d-stat">
					<div class="d-stat-title">Starred</div>
					<div class="d-stat-value">{stats.summary.starredFiles}</div>
					<div class="d-stat-desc">Files</div>
				</div>
			</div>
		</div>

		<div class="grid gap-6 lg:grid-cols-2">
			<div class="d-card border border-base-300 bg-base-100 shadow-sm">
				<div class="d-card-body">
					<h3 class="d-card-title text-base">Storage by type</h3>
					<p class="text-sm text-base-content/60">Share of disk by MIME family (active files).</p>
					<div bind:this={pieEl} class="w-full min-w-0"></div>
				</div>
			</div>
			<div class="d-card border border-base-300 bg-base-100 shadow-sm">
				<div class="d-card-body">
					<h3 class="d-card-title text-base">Files by type</h3>
					<p class="text-sm text-base-content/60">How many files fall in each category.</p>
					<div bind:this={barEl} class="w-full min-w-0 overflow-x-auto"></div>
				</div>
			</div>
		</div>

		<div class="d-card mb-10 border border-base-300 bg-base-100 shadow-sm">
			<div class="d-card-body">
				<h3 class="d-card-title text-base">Activity (12 weeks)</h3>
				<p class="text-sm text-base-content/60">
					Count of active files whose <strong>last modified</strong> time falls in each week (UTC).
				</p>
				<div bind:this={lineEl} class="w-full min-w-0 overflow-x-auto"></div>
			</div>
		</div>
	{/if}
</div>
