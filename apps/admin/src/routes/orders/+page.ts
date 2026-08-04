import { orderStatusValues } from '@packages/schemas';

import { loadOrderPageData } from '$lib/api/admin-api';
import { localizeAdminLabel } from '$lib/labels';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	const { business, orders, pagination } = await loadOrderPageData(url.searchParams);
	return {
		business,
		orders: orders.map((order) => ({
			...order,
			businessName: order.business?.name ?? '一般消費者'
		})),
		pagination,
		statusOptions: orderStatusValues.map((status) => ({
			label: localizeAdminLabel(status),
			value: status
		}))
	};
};
