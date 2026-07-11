import { redirect } from '@sveltejs/kit';

import { getOptionalCurrentStaff, requireCurrentStaff } from '$lib/server/admin-api';

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	if (event.url.pathname === '/login') {
		const currentStaff = await getOptionalCurrentStaff(event);

		if (currentStaff) {
			throw redirect(303, '/');
		}

		return {};
	}

	const currentStaff = await requireCurrentStaff(event);

	return {
		currentStaff: currentStaff.staff
	};
};
