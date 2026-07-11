import { fail, isRedirect, redirect } from '@sveltejs/kit';

import {
	AdminApiError,
	hasMfaSetupToken,
	hasPendingMfaChallenge,
	loginWithPassword
} from '$lib/server/admin-api';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (hasPendingMfaChallenge(event.cookies)) {
		throw redirect(303, '/login/verify');
	}

	if (hasMfaSetupToken(event.cookies)) {
		throw redirect(303, '/login/setup');
	}

	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const email = String(formData.get('email') ?? '').trim();
		const password = String(formData.get('password') ?? '');

		if (!email || !password) {
			return fail(400, {
				email,
				message: '請輸入帳號與密碼。'
			});
		}

		try {
			const result = await loginWithPassword(event, { email, password });

			if (result.status === 'mfa_required') {
				throw redirect(303, '/login/verify');
			}

			if (result.status === 'mfa_setup_required') {
				throw redirect(303, '/login/setup');
			}

			throw redirect(303, '/');
		} catch (caughtError) {
			if (isRedirect(caughtError)) {
				throw caughtError;
			}

			if (caughtError instanceof AdminApiError) {
				return fail(caughtError.status, {
					email,
					message: caughtError.message
				});
			}

			throw caughtError;
		}
	}
};
