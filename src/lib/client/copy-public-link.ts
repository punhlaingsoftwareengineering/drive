import { copyTextFromControlButton, copyTextToClipboard } from '$lib/client/copy-text';
import { StatusColorEnum } from '$lib/model/enum/color.enum';
import { toastService } from '$lib/service/toast.service.svelte';

/** Copy a public-link field next to `button`, with async clipboard fallback. */
export function copyPublicLinkFromButton(button: HTMLButtonElement, toastMsg: string): void {
	try {
		copyTextFromControlButton(button);
		toastService.addToast(toastMsg, StatusColorEnum.SUCCESS);
	} catch {
		const input = button.closest('.d-form-control')?.querySelector('input');
		const value = input instanceof HTMLInputElement ? input.value : '';
		if (!value) {
			toastService.addToast('Nothing to copy', StatusColorEnum.WARNING);
			return;
		}
		void copyTextToClipboard(value)
			.then(() => toastService.addToast(toastMsg, StatusColorEnum.SUCCESS))
			.catch(() =>
				toastService.addToast(
					'Could not copy automatically — select the text in the field and copy manually',
					StatusColorEnum.WARNING
				)
			);
	}
}
