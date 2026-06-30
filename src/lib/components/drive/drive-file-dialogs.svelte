<script lang="ts">
	import { FILE_LABEL_COLORS, fileLabelBadgeClass } from '$lib/model/file-label-color';
	import { colorLabel } from '$lib/components/drive/drive-item';
	import { LucideCopy } from '@lucide/svelte';
	import type { createDriveFileActions } from '$lib/components/drive/use-drive-file-actions.svelte';

	type Actions = ReturnType<typeof createDriveFileActions>;

	let { actions }: { actions: Actions } = $props();
</script>

<dialog bind:this={actions.renameDialogEl} class="d-modal" onclose={actions.closeRename}>
	<div class="d-modal-box max-w-lg">
		<h3 class="d-font-title text-lg font-bold">Rename</h3>
		<label class="d-form-control mt-3 w-full">
			<span class="d-label-text">File name</span>
			<input
				type="text"
				class="d-input-bordered d-input w-full"
				bind:value={actions.draftName}
				disabled={actions.busyId !== null}
				onkeydown={(e) => e.key === 'Enter' && void actions.submitRename()}
			/>
		</label>
		<div class="d-modal-action">
			<form method="dialog">
				<button type="submit" class="d-btn" disabled={actions.busyId !== null}>Cancel</button>
			</form>
			<button
				type="button"
				class="d-btn d-btn-primary"
				disabled={actions.busyId !== null}
				onclick={() => void actions.submitRename()}
			>
				Save
			</button>
		</div>
	</div>
</dialog>

<dialog bind:this={actions.shareDialogEl} class="d-modal" onclose={actions.closeShare}>
	<div class="d-modal-box max-w-md">
		<h3 class="d-font-title text-lg font-bold">
			Share {actions.shareTarget?.itemType === 'folder' ? 'folder' : 'file'}
		</h3>
		{#if actions.shareTarget}
			<p class="py-2 text-sm text-base-content/70">{actions.shareTarget.name}</p>
		{/if}
		<label class="d-form-control mt-2 w-full">
			<span class="d-label-text">Recipient email</span>
			<input
				type="email"
				class="d-input-bordered d-input w-full"
				bind:value={actions.shareEmailDraft}
				disabled={actions.shareSubmitting}
				placeholder="friend@example.com"
				onkeydown={(e) => e.key === 'Enter' && void actions.submitShare()}
			/>
		</label>
		<p class="mt-2 text-xs text-base-content/60">
			{#if actions.shareTarget?.itemType === 'folder'}
				They can open this folder and its contents under Shared while logged in with that email.
			{:else}
				They can download the decrypted file while logged in with that email (read access).
			{/if}
		</p>
		<div class="d-modal-action">
			<form method="dialog">
				<button type="submit" class="d-btn" disabled={actions.shareSubmitting}>Cancel</button>
			</form>
			<button
				type="button"
				class="d-btn d-btn-primary"
				disabled={actions.shareSubmitting || !actions.shareEmailDraft.trim()}
				onclick={() => void actions.submitShare()}
			>
				{actions.shareSubmitting ? 'Sharing…' : 'Share'}
			</button>
		</div>
	</div>
</dialog>

<dialog
	bind:this={actions.copyPublicLinkDialogEl}
	class="d-modal"
	onclose={actions.closeCopyPublicLinkDialog}
>
	<div class="d-modal-box max-w-lg">
		<h3 class="d-font-title text-lg font-bold">Copy public link</h3>
		{#if actions.copyPublicLinkDialog}
			<p class="py-2 text-sm text-base-content/70">{actions.copyPublicLinkDialog.name}</p>
			<div class="mt-2 space-y-4">
				<div class="d-form-control w-full">
					<span class="d-label-text">Share page (full URL)</span>
					<div class="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
						<input
							type="text"
							readonly
							class="d-input-bordered d-input w-full min-w-0 font-mono text-xs"
							value={actions.copyPublicLinkDialog.shareUrl}
						/>
						<button
							type="button"
							class="d-btn shrink-0"
							onclick={(e) => actions.copyDialogSharePageUrl(e)}
						>
							<LucideCopy class="size-4 shrink-0" aria-hidden="true" />
							Copy
						</button>
					</div>
				</div>
				{#if actions.copyPublicLinkDialog.fileDirectUrl}
					<div class="d-form-control w-full">
						<span class="d-label-text">Direct file URL</span>
						<div class="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
							<input
								type="text"
								readonly
								class="d-input-bordered d-input w-full min-w-0 font-mono text-xs"
								value={actions.copyPublicLinkDialog.fileDirectUrl}
							/>
							<button
								type="button"
								class="d-btn shrink-0"
								onclick={(e) => actions.copyDialogDirectFileUrl(e)}
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

<dialog
	bind:this={actions.colorDialogEl}
	class="d-modal"
	onclose={() => (actions.colorTarget = null)}
>
	<div class="d-modal-box max-w-md">
		<h3 class="d-font-title text-lg font-bold">Color</h3>
		{#if actions.colorTarget}
			<p class="py-2 text-sm text-base-content/70">{actions.colorTarget.name}</p>
		{/if}
		<div class="mt-3 flex flex-wrap gap-2">
			{#each FILE_LABEL_COLORS as c (c)}
				<button
					type="button"
					class="{fileLabelBadgeClass(c)} cursor-pointer"
					disabled={actions.busyId !== null || !actions.colorTarget}
					onclick={() => void actions.pickColor(c)}
				>
					{colorLabel(c)}
				</button>
			{/each}
		</div>
		<div class="mt-3">
			<button
				type="button"
				class="d-btn d-btn-ghost d-btn-sm"
				disabled={actions.busyId !== null || !actions.colorTarget}
				onclick={() => void actions.clearItemColor()}
			>
				Clear color
			</button>
		</div>
		<div class="d-modal-action">
			<form method="dialog">
				<button type="submit" class="d-btn" disabled={actions.busyId !== null}>Close</button>
			</form>
		</div>
	</div>
</dialog>
