import { loadBusinessPageData } from '$lib/api/admin-api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	const params = new URLSearchParams(url.searchParams);
	params.set('includeDeleted', url.searchParams.get('archived') === 'true' ? 'true' : 'false');
	const result = await loadBusinessPageData(params);
	return {
		...result,
		businesses: result.businesses.map((business) => ({
			...business,
			isDeleted: business.deletedAt !== null
		}))
	};
};
