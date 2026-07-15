import { orderStatusValues } from '@packages/schemas';

import { loadOrderPageData } from '$lib/api/admin-api';
import { localizeAdminLabel } from '$lib/labels';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	const { businesses, orders, pagination } = await loadOrderPageData(url.searchParams);
	return {
		businesses,
		orders: orders.map((order) => ({
			...order,
			businessName: order.business?.name ?? '一般消費者'
		})),
		pagination,
		businessOptions: [
			{ label: '一般消費者', value: '' },
			...businesses.map((business) => ({ label: business.name, value: business.id }))
		],
		statusOptions: orderStatusValues.map((status) => ({
			label: localizeAdminLabel(status),
			value: status
		}))
	};
};
