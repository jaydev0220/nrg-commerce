import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/errors/app-error.js';
import { createAuthService } from '../../../src/modules/auth/auth.service.js';
import type { AuthRoleRecord, AuthStaffRecord } from '../../../src/types/auth.js';

type AuthServiceDependencies = Parameters<typeof createAuthService>[0];
type RepositoryStub = AuthServiceDependencies['repository'];
type PasswordHasherStub = AuthServiceDependencies['passwordHasher'];
type TokenServiceStub = AuthServiceDependencies['tokenService'];
type TotpServiceStub = AuthServiceDependencies['totpService'];
type PasskeyServiceStub = AuthServiceDependencies['passkeyService'];

const adminRole: AuthRoleRecord = {
	id: 'role-1',
	key: 'admin',
	name: 'Admin',
	permissions: ['staff.read']
};

const staffUpdateAdminRole: AuthRoleRecord = {
	id: 'role-1',
	key: 'admin',
	name: 'Admin',
	permissions: ['staff.read', 'staff.update']
};

const activeStaff: AuthStaffRecord = {
	id: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
	email: 'admin@example.com',
	name: 'Admin',
	status: 'active' as const,
	passwordHash: 'argon2-hash',
	mfaRequired: true,
	preferredMfaMethod: 'authenticator' as const,
	lastLoginAt: null,
	roles: [adminRole],
	totpCredentialCount: 1,
	passkeyCredentialCount: 0
};

function createRepositoryStub(overrides: Partial<RepositoryStub> = {}): RepositoryStub {
	return {
		findStaffByEmail: async () => null,
		findStaffById: async () => null,
		findSessionById: async () => null,
		createSession: async (input) => ({
			id: input.sessionId,
			staffId: input.staffId,
			userAgent: input.userAgent,
			ipAddress: input.ipAddress,
			authenticatedAt: input.authenticatedAt,
			lastSeenAt: null,
			expiresAt: input.expiresAt,
			revokedAt: null
		}),
		findRefreshToken: async () => null,
		replaceRefreshToken: async () => undefined,
		revokeSession: async () => undefined,
		revokeSessionForStaff: async () => false,
		listSessions: async () => [],
		findTotpCredential: async () => ({
			staffId: activeStaff.id,
			secretEncrypted: 'encrypted-secret',
			digits: 6,
			period: 30,
			verifiedAt: new Date('2026-06-12T00:00:00.000Z')
		}),
		updateMfaPreference: async () => undefined,
		upsertTotpCredential: async () => undefined,
		deleteTotpCredential: async () => undefined,
		createPasskeyCredential: async () => {
			throw new Error('not used');
		},
		updatePasskeyCredentialCounter: async () => undefined,
		listPasskeyCredentials: async () => [],
		findPasskeyCredentialByCredentialId: async () => null,
		updatePasswordHash: async () => undefined,
		...overrides
	};
}

function createPasswordHasherStub(overrides: Partial<PasswordHasherStub> = {}): PasswordHasherStub {
	return {
		hash: async () => 'argon2-hash',
		verify: async () => true,
		...overrides
	};
}

function createTokenServiceStub(overrides: Partial<TokenServiceStub> = {}): TokenServiceStub {
	return {
		issueAccessToken: async () => 'access-token',
		verifyAccessToken: async () => {
			throw new Error('not used');
		},
		issueRefreshToken: async () => 'refresh-token',
		verifyRefreshToken: async () => {
			throw new Error('not used');
		},
		issuePendingAuthToken: async () => 'pending-token',
		verifyPendingAuthToken: async () => ({
			type: 'pending_auth',
			staffId: activeStaff.id,
			primaryFactor: 'password',
			requiredMfaMethod: 'authenticator'
		}),
		issueCeremonyToken: async () => 'ceremony-token',
		verifyCeremonyToken: async () => {
			throw new Error('not used');
		},
		...overrides
	};
}

function createTotpServiceStub(overrides: Partial<TotpServiceStub> = {}): TotpServiceStub {
	return {
		createSetup: async () => {
			throw new Error('not used');
		},
		verifyCode: async () => true,
		encryptSecret: (secret) => secret,
		decryptSecret: (secret) => secret,
		...overrides
	};
}

function createPasskeyServiceStub(overrides: Partial<PasskeyServiceStub> = {}): PasskeyServiceStub {
	return {
		beginRegistration: async () => {
			throw new Error('not used');
		},
		finishRegistration: async () => {
			throw new Error('not used');
		},
		beginAuthentication: async () => {
			throw new Error('not used');
		},
		finishAuthentication: async () => {
			throw new Error('not used');
		},
		...overrides
	};
}

function createIdGenerator() {
	let counter = 0;

	return () => `generated-${++counter}`;
}

function createTestAuthService(
	overrides: {
		repository?: Partial<RepositoryStub>;
		passwordHasher?: Partial<PasswordHasherStub>;
		tokenService?: Partial<TokenServiceStub>;
		totpService?: Partial<TotpServiceStub>;
		passkeyService?: Partial<PasskeyServiceStub>;
	} = {}
) {
	return createAuthService({
		repository: createRepositoryStub(overrides.repository),
		passwordHasher: createPasswordHasherStub(overrides.passwordHasher),
		tokenService: createTokenServiceStub(overrides.tokenService),
		totpService: createTotpServiceStub(overrides.totpService),
		passkeyService: createPasskeyServiceStub(overrides.passkeyService),
		now: () => new Date('2026-06-12T00:00:00.000Z'),
		createId: createIdGenerator(),
		hashRefreshToken: (token) => `hashed:${token}`
	});
}

test('loginWithPassword returns an MFA challenge when the staff account requires an authenticator', async () => {
	const authService = createTestAuthService({
		repository: {
			findStaffByEmail: async () => activeStaff
		}
	});

	const result = await authService.loginWithPassword({
		email: 'admin@example.com',
		password: 'correct horse battery staple',
		userAgent: 'test-agent',
		ipAddress: '127.0.0.1'
	});

	assert.equal(result.status, 'mfa_required');
	if (result.status === 'mfa_required') {
		assert.equal(result.method, 'authenticator');
		assert.equal(result.pendingToken, 'pending-token');
	}
});

test('completeTotpLogin creates a session and token pair after a valid pending challenge', async () => {
	let createdSessionId = '';
	let storedRefreshToken = '';

	const authService = createTestAuthService({
		repository: {
			findStaffById: async () => ({
				...activeStaff,
				roles: [staffUpdateAdminRole]
			}),
			createSession: async ({
				refreshTokenHash,
				sessionId,
				staffId,
				userAgent,
				ipAddress,
				authenticatedAt,
				expiresAt
			}) => {
				createdSessionId = sessionId;
				storedRefreshToken = refreshTokenHash;
				return {
					id: sessionId,
					staffId,
					userAgent,
					ipAddress,
					authenticatedAt,
					lastSeenAt: null,
					expiresAt,
					revokedAt: null
				};
			}
		}
	});

	const result = await authService.completeTotpLogin({
		pendingToken: 'pending-token',
		code: '123456',
		userAgent: 'test-agent',
		ipAddress: '127.0.0.1'
	});

	assert.equal(result.status, 'authenticated');
	if (result.status === 'authenticated') {
		assert.equal(result.accessToken, 'access-token');
		assert.equal(result.refreshToken, 'refresh-token');
	}
	assert.equal(createdSessionId, 'generated-1');
	assert.equal(storedRefreshToken, 'hashed:refresh-token');
});

test('completeTotpLogin rejects invalid TOTP codes', async () => {
	const authService = createTestAuthService({
		repository: {
			findStaffById: async () => activeStaff
		},
		totpService: {
			verifyCode: async () => false
		}
	});

	await assert.rejects(
		() =>
			authService.completeTotpLogin({
				pendingToken: 'pending-token',
				code: '123456',
				userAgent: 'test-agent',
				ipAddress: '127.0.0.1'
			}),
		(error: unknown) => error instanceof AppError && error.statusCode === 401
	);
});
