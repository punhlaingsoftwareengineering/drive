<script lang="ts">
	import {
		LucideCopy,
		LucideDownload,
		LucideLink2,
		LucidePalette,
		LucidePencil,
		LucideShare2,
		LucideTrash2
	} from '@lucide/svelte';
	import type { createDriveFileActions } from '$lib/components/drive/use-drive-file-actions.svelte';
	import type { DriveItem } from '$lib/components/drive/drive-item';

	type Actions = ReturnType<typeof createDriveFileActions>;

	let {
		actions,
		menuElementId,
		showFullActions = true
	}: {
		actions: Actions;
		menuElementId: string;
		showFullActions?: boolean;
	} = $props();

	const item = $derived(actions.fileActionsMenuItem);
	const meta = $derived(item ? actions.publicLinkMeta[item.id] : undefined);
</script>

{#if actions.openFileActionsId && actions.fileActionsMenuPosition && item}
	<ul
		id={menuElementId}
		data-open-for={item.id}
		role="menu"
		class="d-menu fixed z-[999] m-0 max-w-[90vw] min-w-[20rem] rounded-box border border-base-200 bg-base-100 p-2 shadow-md"
		style="top: {actions.fileActionsMenuPosition.top}px; left: {actions.fileActionsMenuPosition
			.left}px;"
	>
		{#if showFullActions || item.itemType === 'file' || item.itemType === 'folder'}
			<li role="none">
				<button
					type="button"
					role="menuitem"
					class="justify-start gap-2"
					onclick={() => void actions.onDownloadFile(item)}
				>
					<LucideDownload class="size-4 shrink-0" aria-hidden="true" />
					{item.itemType === 'folder' ? 'Download as ZIP' : 'Download'}
				</button>
			</li>
		{/if}
		{#if showFullActions && actions.canEdit(item)}
			<li role="none">
				<button
					type="button"
					role="menuitem"
					class="justify-start gap-2"
					onclick={() => actions.openShareModal(item)}
				>
					<LucideShare2 class="size-4 shrink-0" aria-hidden="true" />
					Share…
				</button>
			</li>
			{#key item.id}
				<li role="none">
					<button
						type="button"
						role="menuitem"
						class="justify-start gap-2"
						disabled={actions.busyId === item.id}
						onclick={() => void actions.openPublicLinkSection(item.id)}
					>
						<LucideLink2 class="size-4 shrink-0" aria-hidden="true" />
						Public link…
					</button>
				</li>
				{#if actions.publicLinkSectionOpen}
					<li role="none" class="px-2">
						<div class="rounded-box border border-base-200 bg-base-200/40 p-2">
							<button
								type="button"
								role="menuitem"
								class="d-btn d-btn-block justify-start gap-2 d-btn-ghost d-btn-sm"
								disabled={actions.busyId === item.id || meta?.loading === true}
								onclick={() => void actions.onPublicLinkToggle(item, meta?.public !== true)}
							>
								{meta?.public === true ? 'Make private' : 'Make public'}
							</button>
							<button
								type="button"
								role="menuitem"
								class="d-btn mt-1 d-btn-block justify-start gap-2 d-btn-ghost d-btn-sm"
								disabled={actions.busyId === item.id ||
									meta?.loading === true ||
									meta?.public !== true}
								onclick={() => actions.openCopyPublicLinkDialog(item.id)}
							>
								<LucideCopy class="size-4 shrink-0" aria-hidden="true" />
								Copy link
							</button>
							{#if meta?.loading}
								<p class="mt-1 px-1 text-xs text-base-content/50">Loading link…</p>
							{/if}
						</div>
					</li>
				{/if}
			{/key}
			<li role="none">
				<button
					type="button"
					role="menuitem"
					class="justify-start gap-2"
					onclick={() => actions.openRename(item)}
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
					onclick={() => actions.openColorModal(item)}
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
					onclick={() => void actions.onTrash(item)}
				>
					<span class="inline-flex items-center gap-2">
						<LucideTrash2 class="size-4 shrink-0" aria-hidden="true" />
						Move to trash
					</span>
				</button>
			</li>
		{/if}
	</ul>
{/if}
