import { fail, isRedirect, redirect } from '@sveltejs/kit';

import { AdminApiError, beginTotpMfaSetup, completeTotpMfaSetup } from '$lib/server/admin-api';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	availableMethods: ['authenticator', 'passkey'] as const
});

export const actions: Actions = {
	beginTotp: async (event) => {
		try {
			const totpSetup = await beginTotpMfaSetup(event);

			return {
				activeMethod: 'authenticator' as const,
				totpSetup
			};
		} catch (caughtError) {
			if (isRedirect(caughtError)) {
				throw caughtError;
			}

			if (caughtError instanceof AdminApiError) {
				return fail(caughtError.status, {
					activeMethod: 'authenticator' as const,
					message: caughtError.message
				});
			}

			throw caughtError;
		}
	},
	confirmTotp: async (event) => {
		const formData = await event.request.formData();
		const setupToken = String(formData.get('setupToken') ?? '');
		const secret = String(formData.get('secret') ?? '');
		const otpauthUrl = String(formData.get('otpauthUrl') ?? '');
		const digits = Number(formData.get('digits') ?? 0);
		const period = Number(formData.get('period') ?? 0);
		const code = String(formData.get('code') ?? '').trim();
		const totpSetup =
			setupToken && secret && otpauthUrl && digits > 0 && period > 0
				? {
						setupToken,
						secret,
						otpauthUrl,
						digits,
						period
					}
				: undefined;

		if (!setupToken || !code) {
			return fail(400, {
				activeMethod: 'authenticator' as const,
				code,
				totpSetup,
				message: '請完成驗證碼輸入後再送出。'
			});
		}

		try {
			await completeTotpMfaSetup(event, { setupToken, code });
			throw redirect(303, '/');
		} catch (caughtError) {
			if (isRedirect(caughtError)) {
				throw caughtError;
			}

			if (caughtError instanceof AdminApiError) {
				return fail(caughtError.status, {
					activeMethod: 'authenticator' as const,
					code,
					totpSetup,
					message: caughtError.message
				});
			}

			throw caughtError;
		}
	}
};
