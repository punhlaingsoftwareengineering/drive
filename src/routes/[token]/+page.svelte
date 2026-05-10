<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { resolveHref } from '$lib/url/resolve-href';
	import { formatBytes } from '$lib/tool/format-bytes';
	import { fileLooksLikeImage } from '$lib/tool/image-kind';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const share = $derived(data.sharePayload);
	const loadError = $derived(data.shareError);

	let fullPageUrl = $state('');
	let directFileAbsolute = $state('');

	const isImage = $derived(
		Boolean(
			share &&
				share.item.itemType === 'file' &&
				fileLooksLikeImage(share.item.mimeType, share.item.name)
		)
	);
	const rawUrl = $derived(share ? resolveHref(`/api/public/files/${share.token}`) : '');

	$effect(() => {
		if (!browser) {
			fullPageUrl = '';
			directFileAbsolute = '';
			return;
		}
		if (!share) {
			fullPageUrl = '';
			directFileAbsolute = '';
			return;
		}
		fullPageUrl = window.location.href;
		directFileAbsolute = new URL(rawUrl, window.location.origin).href;
	});
</script>

<section class="mx-auto w-full max-w-3xl px-4 py-10">
	<div class="d-card border border-base-content/10 bg-base-100 shadow-sm">
		<div class="d-card-body gap-5">
			<div class="flex flex-col gap-1">
				<h1 class="text-xl font-bold break-words">{share?.item.name ?? 'Shared item'}</h1>
				<p class="text-sm text-base-content/70">Public link. Download is available below.</p>
				{#if fullPageUrl}
					<div class="space-y-1">
						<div class="text-xs text-base-content/60">This page (full URL)</div>
						<input
							type="text"
							readonly
							class="d-input-bordered d-input d-input-sm w-full font-mono text-xs"
							value={fullPageUrl}
						/>
					</div>
				{/if}
			</div>

			{#if loadError}
				<div class="d-alert d-alert-error">
					<span>{loadError}</span>
				</div>
			{:else if share}
				<div class="grid gap-2 text-sm sm:grid-cols-2">
					<div class="text-base-content/60">Type</div>
					<div class="font-medium">{share.item.itemType}</div>

					<div class="text-base-content/60">MIME</div>
					<div class="font-medium break-words">{share.item.mimeType || 'unknown'}</div>

					<div class="text-base-content/60">Size</div>
					<div class="font-medium">{formatBytes(share.item.sizeBytes)}</div>

					<div class="text-base-content/60">Updated</div>
					<div class="font-medium">{share.item.updatedAt.slice(0, 10)}</div>
				</div>

				{#if isImage}
					<div class="rounded-box border border-base-200 bg-base-200/30 p-3">
						<img
							src={rawUrl}
							alt={share.item.name}
							class="max-h-[70vh] w-full object-contain"
							loading="lazy"
						/>
						<p class="mt-2 text-xs break-all text-base-content/60">
							Direct file URL:
							<a class="d-link d-link-primary" href={rawUrl} target="_blank" rel="noreferrer"
								>{directFileAbsolute || rawUrl}</a
							>
						</p>
					</div>
				{/if}

				<div class="flex flex-wrap items-center gap-2">
					<a class="d-btn d-btn-primary" href={rawUrl}>Download</a>
					<a class="d-btn d-btn-ghost" href={resolve('/(public)/onboarding')}>Back to ZNL-DRIVE</a>
				</div>
			{/if}
		</div>
	</div>
</section>
