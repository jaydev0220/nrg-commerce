import { describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
	getAuthState: vi.fn(),
	getOptionalCurrentStaff: vi.fn()
}));

vi.mock('$lib/api/admin-api', () => api);

const { load, prerender, ssr } = await import('./+layout');

function event(path: string) {
	return { url: new URL(`http://localhost${path}`) } as never;
}

describe('admin client layout', () => {
	it('uses prerendered client shells without runtime SSR', () => {
		expect(prerender).toBe(true);
		expect(ssr).toBe(false);
	});

	it('redirects an unauthenticated protected route to login', async () => {
		api.getOptionalCurrentStaff.mockResolvedValueOnce(null);

		await expect(load(event('/products'))).rejects.toMatchObject({
			status: 303,
			location: '/login'
		});
	});

	it('returns the current staff for protected routes', async () => {
		api.getOptionalCurrentStaff.mockResolvedValueOnce({ staff: { id: 'staff-id' } });

		await expect(load(event('/'))).resolves.toMatchObject({
			currentStaff: { id: 'staff-id' },
			authState: { status: 'authenticated' }
		});
	});

	it('routes an unfinished MFA challenge to the verification screen', async () => {
		api.getAuthState.mockResolvedValueOnce({ status: 'mfa_required', method: 'authenticator' });

		await expect(load(event('/login'))).rejects.toMatchObject({
			status: 303,
			location: '/login/verify'
		});
	});

	it('routes an unenrolled staff member to the MFA setup screen', async () => {
		api.getAuthState.mockResolvedValueOnce({
			status: 'mfa_setup_required',
			availableMethods: ['authenticator', 'passkey']
		});

		await expect(load(event('/login'))).rejects.toMatchObject({
			status: 303,
			location: '/login/setup'
		});
	});
});
