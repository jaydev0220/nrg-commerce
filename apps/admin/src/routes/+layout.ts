import { redirect } from '@sveltejs/kit';

import { getAuthState, getOptionalCurrentStaff, refreshCurrentSession } from '$lib/api/admin-api';
import type { LayoutLoad } from './$types';

export const ssr = false;
export const prerender = true;

export const load: LayoutLoad = async ({ url }) => {
	const isLoginRoute = url.pathname.startsWith('/login');
	if (isLoginRoute) {
		let state = await getAuthState();
		if (state.status === 'refresh_required' && (await refreshCurrentSession())) {
			state = await getAuthState();
		}
		if (state.status === 'authenticated') throw redirect(303, '/');
		if (state.status === 'mfa_required' && url.pathname !== '/login/verify') {
			throw redirect(303, '/login/verify');
		}
		if (state.status === 'mfa_setup_required' && url.pathname !== '/login/setup') {
			throw redirect(303, '/login/setup');
		}
		if (
			state.status === 'unauthenticated' &&
			(url.pathname === '/login/setup' || url.pathname === '/login/verify')
		) {
			throw redirect(303, '/login');
		}
		return { currentStaff: null, sessionId: null, authState: state };
	}

	const current = await getOptionalCurrentStaff();
	if (!current) throw redirect(303, '/login');
	return {
		currentStaff: current.staff,
		sessionId: current.sessionId,
		authState: { status: 'authenticated' as const }
	};
};
