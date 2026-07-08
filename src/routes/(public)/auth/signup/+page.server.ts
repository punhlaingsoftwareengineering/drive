import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { portalLoginUrl } from '$lib/server/portal-origin';

/** Public signup is disabled — accounts are created via the employee portal. */
export const load: PageServerLoad = () => {
	throw redirect(303, portalLoginUrl());
};
