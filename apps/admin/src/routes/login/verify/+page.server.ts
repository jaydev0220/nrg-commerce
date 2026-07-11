import { fail, isRedirect, redirect } from '@sveltejs/kit';

import {
	AdminApiError,
	completeTotpLoginChallenge,
	readPendingMfaMethod
} from '$lib/server/admin-api';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const method = readPendingMfaMethod(event.cookies);

	if (!method) {
		throw redirect(303, '/login');
	}

	return { method };
};

export const actions: Actions = {
	totp: async (event) => {
		const code = String((await event.request.formData()).get('code') ?? '').trim();

		if (!code) {
			return fail(400, {
				code,
				message: '請輸入驗證碼。'
			});
		}

		try {
			await completeTotpLoginChallenge(event, code);
			throw redirect(303, '/');
		} catch (caughtError) {
			if (isRedirect(caughtError)) {
				throw caughtError;
			}

			if (caughtError instanceof AdminApiError) {
				return fail(caughtError.status, {
					code,
					message: caughtError.message
				});
			}

			throw caughtError;
		}
	}
};
