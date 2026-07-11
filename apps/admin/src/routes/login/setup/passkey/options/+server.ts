import { json } from '@sveltejs/kit';

import { AdminApiError, beginPasskeyMfaSetup } from '$lib/server/admin-api';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json().catch(() => ({}))) as { nickname?: string };
		const payload = await beginPasskeyMfaSetup(event, {
			nickname: body.nickname?.trim() || undefined
		});

		return json(payload);
	} catch (caughtError) {
		if (caughtError instanceof AdminApiError) {
			return json({ message: caughtError.message }, { status: caughtError.status });
		}

		throw caughtError;
	}
};
