import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminApiMocks = vi.hoisted(() => ({
	beginTotpMfaSetup: vi.fn(),
	completeTotpMfaSetup: vi.fn(),
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
type SetupAction = NonNullable<(typeof actions)['beginTotp']>;
type SetupActionEvent = Parameters<SetupAction>[0];
type SetupLoadEvent = Parameters<typeof load>[0];

function createEvent(formData?: FormData): SetupActionEvent {
	return {
		cookies: {},
		fetch: vi.fn(),
		params: {},
		locals: {},
		url: new URL('http://localhost/login/setup'),
		route: { id: '/login/setup' },
		parent: vi.fn(),
		depends: vi.fn(),
		untrack: vi.fn((callback: () => unknown) => callback()),
		request: {
			formData: async () => formData ?? new FormData()
		}
	} as unknown as SetupActionEvent;
}

describe('login setup page server', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns the available MFA methods', async () => {
		const result = await load({} as unknown as SetupLoadEvent);

		expect(result).toEqual({
			availableMethods: ['authenticator', 'passkey']
		});
	});

	it('returns TOTP setup material through the beginTotp action', async () => {
		adminApiMocks.beginTotpMfaSetup.mockResolvedValue({
			setupToken: 'setup-token',
			secret: 'secret-value',
			otpauthUrl: 'otpauth://totp/test',
			digits: 6,
			period: 30
		});

		const result = await actions['beginTotp']!(createEvent());

		expect(result).toEqual({
			activeMethod: 'authenticator',
			totpSetup: {
				setupToken: 'setup-token',
				secret: 'secret-value',
				otpauthUrl: 'otpauth://totp/test',
				digits: 6,
				period: 30
			}
		});
	});
});
