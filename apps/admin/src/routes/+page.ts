import { loadDashboardData, type DashboardRange } from '$lib/api/admin-api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	const value = url.searchParams.get('range');
	const range: DashboardRange = value === 'months' || value === 'quarters' ? value : 'days';
	return { dashboard: await loadDashboardData(range) };
};
