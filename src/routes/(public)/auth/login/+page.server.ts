import type { PageServerLoad } from './$types';
import { portalLoginUrl } from '$lib/server/portal-origin';

export const load: PageServerLoad = () => {
	return {
		portalLoginUrl: portalLoginUrl()
	};
};
