import { json } from '@sveltejs/kit';

import { AdminApiError, completePasskeyMfaSetup } from '$lib/server/admin-api';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as {
			ceremonyToken?: string;
			credential?: unknown;
		};

		if (!body.ceremonyToken || !body.credential) {
			return json({ message: '通行密鑰資料不完整。' }, { status: 400 });
		}

		await completePasskeyMfaSetup(event, {
			ceremonyToken: body.ceremonyToken,
			credential: body.credential
		});

		return json({ redirectTo: '/' });
	} catch (caughtError) {
		if (caughtError instanceof AdminApiError) {
			return json({ message: caughtError.message }, { status: caughtError.status });
		}

		throw caughtError;
	}
};
