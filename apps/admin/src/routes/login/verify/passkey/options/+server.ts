import { json } from '@sveltejs/kit';

import { AdminApiError, beginPasskeyLoginChallenge } from '$lib/server/admin-api';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	try {
		const payload = await beginPasskeyLoginChallenge(event);
		return json(payload);
	} catch (caughtError) {
		if (caughtError instanceof AdminApiError) {
			return json({ message: caughtError.message }, { status: caughtError.status });
		}

		throw caughtError;
	}
};
