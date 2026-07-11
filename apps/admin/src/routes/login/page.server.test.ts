import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminApiMocks = vi.hoisted(() => ({
	loginWithPassword: vi.fn(),
	hasPendingMfaChallenge: vi.fn(() => false),
	hasMfaSetupToken: vi.fn(() => false),
	AdminApiError: class AdminApiError extends Error {
		status: number;

		constructor(status: number, message: string) {
			super(message);
			this.status = status;
		}
	}
}));

vi.mock('$lib/server/admin-api', () => adminApiMocks);

const { actions, load } = await import('./+page.server');
type LoginAction = NonNullable<(typeof actions)['default']>;
type LoginActionEvent = Parameters<LoginAction>[0];
type LoginLoadEvent = Parameters<typeof load>[0];

function createActionEvent(formData?: FormData): LoginActionEvent {
	return {
		cookies: {},
		fetch: vi.fn(),
		params: {},
		locals: {},
		url: new URL('http://localhost/login'),
		route: { id: '/login' },
		parent: vi.fn(),
		depends: vi.fn(),
		untrack: vi.fn((callback: () => unknown) => callback()),
		request: {
			formData: async () => formData ?? new FormData()
		}
	} as unknown as LoginActionEvent;
}

describe('login page server', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		adminApiMocks.hasPendingMfaChallenge.mockReturnValue(false);
		adminApiMocks.hasMfaSetupToken.mockReturnValue(false);
	});

	it('redirects load to verification when a pending MFA challenge cookie exists', async () => {
		adminApiMocks.hasPendingMfaChallenge.mockReturnValue(true);

		await expect(
			load({
				cookies: {},
				url: new URL('http://localhost/login')
			} as unknown as LoginLoadEvent)
		).rejects.toMatchObject({ location: '/login/verify' });
	});

	it('redirects login submissions to setup flow when the API returns setup-required', async () => {
		const formData = new FormData();
		formData.set('email', 'admin@example.com');
		formData.set('password', 'correct horse battery staple');
		adminApiMocks.loginWithPassword.mockResolvedValue({
			status: 'mfa_setup_required'
		});

		await expect(actions['default']!(createActionEvent(formData))).rejects.toMatchObject({
			location: '/login/setup'
		});
	});
});
