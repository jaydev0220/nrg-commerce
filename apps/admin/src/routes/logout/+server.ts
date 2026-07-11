import { redirect } from '@sveltejs/kit';

import { logoutCurrentSession } from '$lib/server/admin-api';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	await logoutCurrentSession(event);
	throw redirect(303, '/login');
};
