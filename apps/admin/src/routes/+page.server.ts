import { asPageError, loadDashboardData } from '$lib/server/admin-api';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	try {
		return {
			dashboard: await loadDashboardData(event)
		};
	} catch (caughtError) {
		return asPageError(caughtError);
	}
};
