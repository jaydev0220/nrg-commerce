import { redirect } from '@sveltejs/kit';

import {
	clearSessionCookies,
	getOptionalCurrentStaff,
	hasMfaSetupToken,
	hasPendingMfaChallenge,
	requireCurrentStaff
} from '$lib/server/admin-api';

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	if (event.url.pathname.startsWith('/login')) {
		const currentStaff = await getOptionalCurrentStaff(event);

		if (currentStaff?.mfaMethods.length) {
			throw redirect(303, '/');
		}

		if (currentStaff && currentStaff.mfaMethods.length === 0) {
			clearSessionCookies(event.cookies);
			throw redirect(303, '/login');
		}

		if (event.url.pathname === '/login/setup' && !hasMfaSetupToken(event.cookies)) {
			throw redirect(303, '/login');
		}

		if (event.url.pathname === '/login/verify' && !hasPendingMfaChallenge(event.cookies)) {
			throw redirect(303, '/login');
		}

		return {
			currentStaff: null
		};
	}

	const currentStaff = await requireCurrentStaff(event);

	if (currentStaff.mfaMethods.length === 0) {
		clearSessionCookies(event.cookies);
		throw redirect(303, '/login');
	}

	return {
		currentStaff: currentStaff.staff
	};
};
