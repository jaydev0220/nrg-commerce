import { fail, isRedirect, redirect } from '@sveltejs/kit';

import { AdminApiError, loginWithPassword } from '$lib/server/admin-api';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({});

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
				return fail(400, {
					email,
					message: '此管理後台尚未支援多因素登入流程。'
				});
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
