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
	preferredMfaMethod: 'authenticator' as const,
	lastLoginAt: null,
	failedAuthCount: 0,
	failedAuthWindowStartedAt: null,
	authBlockedUntil: null,
	roles: [adminRole],
	totpCredentialCount: 1,
	passkeyCredentialCount: 0
};

function createRepositoryStub(overrides: Partial<RepositoryStub> = {}): RepositoryStub {
	return {
		findStaffByEmail: async () => null,
		findStaffById: async () => null,
		recordFailedPasswordAttempt: async () => ({ authBlockedUntil: null }),
		clearFailedPasswordAttempts: async () => true,
		consumeTotpTimeStep: async () => true,
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
		replaceRefreshToken: async () => true,
		revokeSession: async () => undefined,
		revokeSessionForStaff: async () => false,
		listSessions: async () => [],
		findTotpCredential: async () => ({
			staffId: activeStaff.id,
			secretEncrypted: 'encrypted-secret',
			digits: 6,
			period: 30,
			verifiedAt: new Date('2026-06-12T00:00:00.000Z'),
			lastUsedAt: null,
			lastUsedTimeStep: null
		}),
		updateMfaPreference: async () => undefined,
		upsertTotpCredential: async () => undefined,
		deleteTotpCredential: async () => 'removed',
		createPasskeyCredential: async () => {
			throw new Error('not used');
		},
		consumePasskeyAuthentication: async () => true,
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
			preferredMfaMethod: 'authenticator',
			availableMfaMethods: ['authenticator']
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
		verifyCodeWithTimeStep: async () => ({ valid: true, timeStep: 1n }),
		encryptSecret: (secret) => secret,
		decryptSecret: (secret) => secret,
		...overrides
	};
}

test('invalid access tokens are reported as authentication failures', async () => {
	const service = createAuthService({
		repository: createRepositoryStub(),
		passwordHasher: createPasswordHasherStub(),
		tokenService: createTokenServiceStub({
			verifyAccessToken: async () => {
				throw new Error('JWT expired');
			}
		}),
		totpService: createTotpServiceStub(),
		passkeyService: createPasskeyServiceStub(),
		now: () => new Date('2026-07-12T00:00:00.000Z'),
		createId: () => 'generated-id',
		hashRefreshToken: (token) => `hashed:${token}`,
		sessionTtlSeconds: 3600
	});

	await assert.rejects(service.authenticateAccessToken('expired-token'), (error: unknown) => {
		assert.ok(error instanceof AppError);
		assert.equal(error.statusCode, 401);
		assert.equal(error.code, 'AUTHENTICATION_REQUIRED');
		return true;
	});
});

test('invalid refresh tokens are reported as authentication failures', async () => {
	const service = createAuthService({
		repository: createRepositoryStub(),
		passwordHasher: createPasswordHasherStub(),
		tokenService: createTokenServiceStub({
			verifyRefreshToken: async () => {
				throw new Error('JWT expired');
			}
		}),
		totpService: createTotpServiceStub(),
		passkeyService: createPasskeyServiceStub(),
		now: () => new Date('2026-07-12T00:00:00.000Z'),
		createId: () => 'generated-id',
		hashRefreshToken: (token) => `hashed:${token}`,
		sessionTtlSeconds: 3600
	});

	await assert.rejects(service.refreshSession('expired-token', null, null), (error: unknown) => {
		assert.ok(error instanceof AppError);
		assert.equal(error.statusCode, 401);
		assert.equal(error.code, 'INVALID_REFRESH_TOKEN');
		return true;
	});
});

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
		now?: () => Date;
		sessionTtlSeconds?: number;
		sessionAbsoluteTtlSeconds?: number;
		recordAuthDiagnostic?: AuthServiceDependencies['recordAuthDiagnostic'];
	} = {}
) {
	return createAuthService({
		repository: createRepositoryStub(overrides.repository),
		passwordHasher: createPasswordHasherStub(overrides.passwordHasher),
		tokenService: createTokenServiceStub(overrides.tokenService),
		totpService: createTotpServiceStub(overrides.totpService),
		passkeyService: createPasskeyServiceStub(overrides.passkeyService),
		now: overrides.now ?? (() => new Date('2026-06-12T00:00:00.000Z')),
		createId: createIdGenerator(),
		hashRefreshToken: (token) => `hashed:${token}`,
		sessionTtlSeconds: overrides.sessionTtlSeconds,
		sessionAbsoluteTtlSeconds: overrides.sessionAbsoluteTtlSeconds,
		recordAuthDiagnostic: overrides.recordAuthDiagnostic
	});
}

test('refreshSession extends the persisted session before issuing a usable access token', async () => {
	const now = new Date('2026-06-12T00:00:00.000Z');
	const authenticatedAt = new Date('2026-06-01T00:00:00.000Z');
	const originalSession = {
		id: 'session-1',
		staffId: activeStaff.id,
		userAgent: 'original-agent',
		ipAddress: '127.0.0.1',
		authenticatedAt,
		lastSeenAt: new Date('2026-06-05T00:00:00.000Z'),
		expiresAt: new Date('2026-06-10T00:00:00.000Z'),
		revokedAt: null
	};
	let persistedSession = originalSession;
	let rotationInput:
		| {
				newExpiresAt: Date;
				sessionExpiresAt: Date;
				sessionLastSeenAt: Date;
		  }
		| undefined;
	const authService = createTestAuthService({
		now: () => now,
		sessionTtlSeconds: 7 * 24 * 60 * 60,
		sessionAbsoluteTtlSeconds: 30 * 24 * 60 * 60,
		repository: {
			findRefreshToken: async () =>
				({
					id: 'refresh-1',
					sessionId: originalSession.id,
					staffId: activeStaff.id,
					jwtId: 'refresh-jwt-1',
					tokenHash: 'hashed:refresh-token',
					expiresAt: new Date('2026-06-13T00:00:00.000Z'),
					consumedAt: null,
					revokedAt: null,
					session: originalSession,
					staff: activeStaff
				}) as never,
			replaceRefreshToken: async (input) => {
				rotationInput = input;
				persistedSession = {
					...originalSession,
					lastSeenAt: input.sessionLastSeenAt,
					expiresAt: input.sessionExpiresAt
				};
				return true;
			},
			findSessionById: async () => ({ session: persistedSession, staff: activeStaff })
		},
		tokenService: {
			verifyRefreshToken: async () => ({
				sub: activeStaff.id,
				sid: originalSession.id,
				jti: 'refresh-jwt-1',
				type: 'refresh',
				mfa: ['authenticator'],
				primaryFactor: 'password',
				exp: 1,
				iat: 1
			}),
			verifyAccessToken: async () => ({
				sub: activeStaff.id,
				sid: originalSession.id,
				jti: 'access-jwt-2',
				type: 'access',
				roles: ['admin'],
				permissions: ['staff.read'],
				mfa: ['authenticator'],
				primaryFactor: 'password',
				exp: 1,
				iat: 1
			})
		}
	});

	const result = await authService.refreshSession('refresh-token', 'new-agent', '127.0.0.2');
	const authContext = await authService.authenticateAccessToken(result.accessToken);

	assert.equal(rotationInput?.newExpiresAt.toISOString(), '2026-06-19T00:00:00.000Z');
	assert.equal(rotationInput?.sessionExpiresAt.toISOString(), '2026-06-19T00:00:00.000Z');
	assert.equal(rotationInput?.sessionLastSeenAt, now);
	assert.equal(result.session.authenticatedAt, authenticatedAt);
	assert.equal(authContext.sessionId, originalSession.id);
});

test('refreshSession rejects sessions beyond the absolute lifetime', async () => {
	let revokedSessionId = '';
	const diagnostics: Array<{ code: string; sessionId: string; requestId?: string }> = [];
	const authService = createTestAuthService({
		now: () => new Date('2026-06-12T00:00:00.000Z'),
		sessionAbsoluteTtlSeconds: 30 * 24 * 60 * 60,
		recordAuthDiagnostic: (event) => diagnostics.push(event),
		repository: {
			findRefreshToken: async () =>
				({
					id: 'refresh-1',
					sessionId: 'session-1',
					staffId: activeStaff.id,
					jwtId: 'refresh-jwt-1',
					tokenHash: 'hashed:refresh-token',
					expiresAt: new Date('2026-06-13T00:00:00.000Z'),
					consumedAt: null,
					revokedAt: null,
					session: {
						id: 'session-1',
						staffId: activeStaff.id,
						userAgent: null,
						ipAddress: null,
						authenticatedAt: new Date('2026-05-01T00:00:00.000Z'),
						lastSeenAt: null,
						expiresAt: new Date('2026-06-13T00:00:00.000Z'),
						revokedAt: null
					},
					staff: activeStaff
				}) as never,
			revokeSession: async (sessionId) => {
				revokedSessionId = sessionId;
			}
		},
		tokenService: {
			verifyRefreshToken: async () =>
				({
					sub: activeStaff.id,
					sid: 'session-1',
					jti: 'refresh-jwt-1',
					mfa: [],
					primaryFactor: 'password'
				}) as never
		}
	});

	await assert.rejects(
		() => authService.refreshSession('refresh-token', null, null, 'request-1'),
		(error: unknown) => error instanceof AppError && error.code === 'SESSION_ABSOLUTE_EXPIRED'
	);
	assert.equal(revokedSessionId, 'session-1');
	assert.deepEqual(diagnostics, [
		{ code: 'SESSION_ABSOLUTE_EXPIRED', sessionId: 'session-1', requestId: 'request-1' }
	]);
});

test('refreshSession revokes the session when atomic token rotation loses a race', async () => {
	let revokedSessionId = '';
	const authService = createTestAuthService({
		repository: {
			findRefreshToken: async () =>
				({
					id: 'refresh-1',
					sessionId: 'session-1',
					staffId: activeStaff.id,
					jwtId: 'refresh-jwt-1',
					tokenHash: 'hashed:refresh-token',
					expiresAt: new Date('2026-06-13T00:00:00.000Z'),
					consumedAt: null,
					revokedAt: null,
					session: {
						id: 'session-1',
						staffId: activeStaff.id,
						userAgent: null,
						ipAddress: null,
						authenticatedAt: new Date('2026-06-01T00:00:00.000Z'),
						lastSeenAt: null,
						expiresAt: new Date('2026-06-13T00:00:00.000Z'),
						revokedAt: null
					},
					staff: activeStaff
				}) as never,
			replaceRefreshToken: async () => false,
			revokeSession: async (sessionId) => {
				revokedSessionId = sessionId;
			}
		},
		tokenService: {
			verifyRefreshToken: async () =>
				({
					sub: activeStaff.id,
					sid: 'session-1',
					jti: 'refresh-jwt-1',
					mfa: [],
					primaryFactor: 'password'
				}) as never
		}
	});

	await assert.rejects(
		() => authService.refreshSession('refresh-token', null, null),
		(error: unknown) => error instanceof AppError && error.code === 'REFRESH_TOKEN_REPLAY'
	);
	assert.equal(revokedSessionId, 'session-1');
});

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

test('loginWithPassword exposes every enrolled MFA method with the preferred method first', async () => {
	const authService = createTestAuthService({
		repository: {
			findStaffByEmail: async () => ({
				...activeStaff,
				passkeyCredentialCount: 1
			})
		}
	});

	const result = await authService.loginWithPassword({
		email: activeStaff.email,
		password: 'correct horse battery staple',
		userAgent: null,
		ipAddress: null
	});

	assert.equal(result.status, 'mfa_required');
	if (result.status === 'mfa_required') {
		assert.equal(result.method, 'authenticator');
		assert.deepEqual(result.availableMethods, ['authenticator', 'passkey']);
	}
});

test('loginWithPassword performs password verification for unknown accounts before rejecting', async () => {
	let verifiedDigest = '';
	const authService = createTestAuthService({
		repository: {
			findStaffByEmail: async () => null
		},
		passwordHasher: {
			verify: async (_password, digest) => {
				verifiedDigest = digest;
				return false;
			}
		}
	});

	await assert.rejects(
		() =>
			authService.loginWithPassword({
				email: 'missing@example.com',
				password: 'incorrect password',
				userAgent: null,
				ipAddress: null
			}),
		(error: unknown) => error instanceof AppError && error.code === 'INVALID_CREDENTIALS'
	);
	assert.match(verifiedDigest, /^\$argon2id\$/u);
});

test('loginWithPassword atomically blocks the fifth failed attempt', async () => {
	const now = new Date('2026-06-12T00:00:00.000Z');
	let failedAttempts = 0;
	const authService = createTestAuthService({
		now: () => now,
		repository: {
			findStaffByEmail: async () => activeStaff,
			recordFailedPasswordAttempt: async () => {
				failedAttempts += 1;
				return {
					authBlockedUntil: failedAttempts >= 5 ? new Date(now.getTime() + 15 * 60 * 1000) : null
				};
			}
		},
		passwordHasher: {
			verify: async () => false
		}
	});

	for (let attempt = 1; attempt < 5; attempt += 1) {
		await assert.rejects(
			() =>
				authService.loginWithPassword({
					email: activeStaff.email,
					password: 'incorrect password',
					userAgent: null,
					ipAddress: null
				}),
			(error: unknown) => error instanceof AppError && error.code === 'INVALID_CREDENTIALS'
		);
	}

	await assert.rejects(
		() =>
			authService.loginWithPassword({
				email: activeStaff.email,
				password: 'incorrect password',
				userAgent: null,
				ipAddress: null
			}),
		(error: unknown) =>
			error instanceof AppError && error.code === 'AUTHENTICATION_TEMPORARILY_BLOCKED'
	);
	assert.equal(failedAttempts, 5);
});

test('loginWithPassword rejects a valid password when a concurrent attempt locks the account', async () => {
	const authService = createTestAuthService({
		repository: {
			findStaffByEmail: async () => activeStaff,
			clearFailedPasswordAttempts: async () => false
		}
	});

	await assert.rejects(
		() =>
			authService.loginWithPassword({
				email: activeStaff.email,
				password: 'correct horse battery staple',
				userAgent: null,
				ipAddress: null
			}),
		(error: unknown) =>
			error instanceof AppError && error.code === 'AUTHENTICATION_TEMPORARILY_BLOCKED'
	);
});

test('direct passkey login requires user verification and creates a passkey session', async () => {
	const storedCredential = {
		id: 'credential-record',
		staffId: activeStaff.id,
		credentialId: 'credential-id',
		publicKey: new Uint8Array(),
		userHandle: null,
		counter: 0,
		transports: [],
		aaguid: null,
		deviceType: null,
		backedUp: null,
		nickname: null,
		verifiedAt: null,
		lastUsedAt: null
	} as never;
	let finishRequiresUserVerification: boolean | undefined;

	const authService = createTestAuthService({
		repository: {
			findStaffById: async () => ({ ...activeStaff, passkeyCredentialCount: 1 }),
			findPasskeyCredentialByCredentialId: async () => storedCredential,
			consumePasskeyAuthentication: async () => true
		},
		tokenService: {
			verifyCeremonyToken: async <T>() =>
				({
					staffId: activeStaff.id,
					challenge: 'direct-challenge',
					primaryFactor: 'passkey'
				}) as T
		},
		passkeyService: {
			beginAuthentication: async () => ({ challenge: 'direct-challenge' }) as never,
			finishAuthentication: async (
				_challenge,
				_credential,
				_storedCredential,
				requireUserVerification
			) => {
				finishRequiresUserVerification = requireUserVerification;
				return { verified: true, authenticationInfo: { newCounter: 1 } } as never;
			}
		}
	});

	await authService.beginPasskeyLogin();
	const result = await authService.verifyPasskeyLogin({
		ceremonyToken: 'ceremony-token',
		credential: { id: 'credential-id' } as never,
		userAgent: null,
		ipAddress: null
	});

	assert.equal(finishRequiresUserVerification, true);
	assert.equal(result.status, 'authenticated');
	if (result.status === 'authenticated') {
		assert.equal(result.staff.id, activeStaff.id);
	}
});

test('direct passkey login rejects an assertion already claimed by another request', async () => {
	const storedCredential = {
		id: 'credential-record',
		staffId: activeStaff.id,
		credentialId: 'credential-id',
		publicKey: new Uint8Array(),
		userHandle: null,
		counter: 0,
		transports: [],
		aaguid: null,
		deviceType: null,
		backedUp: null,
		nickname: null,
		verifiedAt: new Date('2026-06-12T00:00:00.000Z'),
		lastUsedAt: null
	} as never;
	let sessionCreated = false;

	const authService = createTestAuthService({
		repository: {
			findStaffById: async () => ({ ...activeStaff, passkeyCredentialCount: 1 }),
			findPasskeyCredentialByCredentialId: async () => storedCredential,
			consumePasskeyAuthentication: async () => false,
			createSession: async () => {
				sessionCreated = true;
				throw new Error('must not create a session');
			}
		},
		tokenService: {
			verifyCeremonyToken: async <T>() =>
				({
					staffId: activeStaff.id,
					challenge: 'direct-challenge',
					primaryFactor: 'passkey'
				}) as T
		},
		passkeyService: {
			finishAuthentication: async () =>
				({ verified: true, authenticationInfo: { newCounter: 1 } }) as never
		}
	});

	await assert.rejects(
		() =>
			authService.verifyPasskeyLogin({
				ceremonyToken: 'ceremony-token',
				credential: { id: 'credential-id' } as never,
				userAgent: null,
				ipAddress: null
			}),
		(error: unknown) => error instanceof AppError && error.code === 'PASSKEY_VERIFICATION_FAILED'
	);
	assert.equal(sessionCreated, false);
});

test('passkey MFA permits possession-only verification and rejects another staff credential', async () => {
	const storedCredential = {
		id: 'credential-record',
		staffId: activeStaff.id,
		credentialId: 'credential-id',
		publicKey: new Uint8Array(),
		userHandle: null,
		counter: 0,
		transports: [],
		aaguid: null,
		deviceType: null,
		backedUp: null,
		nickname: null,
		verifiedAt: null,
		lastUsedAt: null
	} as never;
	let authenticationUserVerification: 'required' | 'preferred' | 'discouraged' | undefined;
	let finishRequiresUserVerification: boolean | undefined;

	const authService = createTestAuthService({
		repository: {
			findStaffById: async () => ({ ...activeStaff, passkeyCredentialCount: 1 }),
			listPasskeyCredentials: async () => [storedCredential],
			findPasskeyCredentialByCredentialId: async () => storedCredential,
			consumePasskeyAuthentication: async () => true
		},
		tokenService: {
			verifyPendingAuthToken: async () => ({
				type: 'pending_auth',
				staffId: activeStaff.id,
				primaryFactor: 'password',
				preferredMfaMethod: 'passkey',
				availableMfaMethods: ['passkey']
			}),
			verifyCeremonyToken: async <T>() =>
				({
					staffId: activeStaff.id,
					challenge: 'mfa-challenge',
					primaryFactor: 'password'
				}) as T
		},
		passkeyService: {
			beginAuthentication: async (_credentials, userVerification) => {
				authenticationUserVerification = userVerification;
				return { challenge: 'mfa-challenge' } as never;
			},
			finishAuthentication: async (
				_challenge,
				_credential,
				_storedCredential,
				requireUserVerification
			) => {
				finishRequiresUserVerification = requireUserVerification;
				return { verified: true, authenticationInfo: { newCounter: 1 } } as never;
			}
		}
	});

	await authService.beginPasskeyMfa('pending-token');
	const result = await authService.verifyPasskeyMfa({
		ceremonyToken: 'ceremony-token',
		credential: { id: 'credential-id' } as never,
		userAgent: null,
		ipAddress: null
	});

	assert.equal(authenticationUserVerification, 'discouraged');
	assert.equal(finishRequiresUserVerification, false);
	assert.equal(result.status, 'authenticated');

	const mismatchService = createTestAuthService({
		repository: {
			findStaffById: async () => ({ ...activeStaff, passkeyCredentialCount: 1 }),
			findPasskeyCredentialByCredentialId: async () =>
				Object.assign({}, storedCredential as object, { staffId: 'other-staff' }) as never
		},
		tokenService: {
			verifyCeremonyToken: async <T>() =>
				({
					staffId: activeStaff.id,
					challenge: 'mfa-challenge',
					primaryFactor: 'password'
				}) as T
		}
	});

	await assert.rejects(
		() =>
			mismatchService.verifyPasskeyMfa({
				ceremonyToken: 'ceremony-token',
				credential: { id: 'credential-id' } as never,
				userAgent: null,
				ipAddress: null
			}),
		(error: unknown) => error instanceof AppError && error.code === 'PASSKEY_VERIFICATION_FAILED'
	);
});

test('completeTotpLogin creates a session and token pair after a valid pending challenge', async () => {
	let createdSessionId = '';
	let storedRefreshToken = '';
	let createdSessionExpiresAt = '';

	const authService = createTestAuthService({
		sessionTtlSeconds: 60 * 24 * 60 * 60,
		sessionAbsoluteTtlSeconds: 30 * 24 * 60 * 60,
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
				createdSessionExpiresAt = expiresAt.toISOString();
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
	assert.equal(createdSessionExpiresAt, '2026-07-12T00:00:00.000Z');
});

test('completeTotpLogin rejects invalid TOTP codes', async () => {
	const authService = createTestAuthService({
		repository: {
			findStaffById: async () => activeStaff
		},
		totpService: {
			verifyCodeWithTimeStep: async () => ({ valid: false })
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

test('completeTotpLogin rejects a code when its time step was consumed concurrently', async () => {
	let verificationAfterTimeStep: bigint | null | undefined;
	let consumedTimeStep: bigint | undefined;
	const authService = createTestAuthService({
		repository: {
			findStaffById: async () => activeStaff,
			findTotpCredential: async () => ({
				staffId: activeStaff.id,
				secretEncrypted: 'encrypted-secret',
				digits: 6,
				period: 30,
				verifiedAt: new Date('2026-06-12T00:00:00.000Z'),
				lastUsedAt: new Date('2026-06-12T00:00:00.000Z'),
				lastUsedTimeStep: 41n
			}),
			consumeTotpTimeStep: async (_staffId, timeStep) => {
				consumedTimeStep = timeStep;
				return false;
			}
		},
		totpService: {
			verifyCodeWithTimeStep: async (_secret, _code, _digits, _period, afterTimeStep) => {
				verificationAfterTimeStep = afterTimeStep;
				return { valid: true, timeStep: 42n };
			}
		}
	});

	await assert.rejects(
		() =>
			authService.completeTotpLogin({
				pendingToken: 'pending-token',
				code: '123456',
				userAgent: null,
				ipAddress: null
			}),
		(error: unknown) => error instanceof AppError && error.code === 'INVALID_TOTP_CODE'
	);
	assert.equal(verificationAfterTimeStep, 41n);
	assert.equal(consumedTimeStep, 42n);
});

test('loginWithPassword requires initial MFA setup when no credential is enrolled', async () => {
	const authService = createTestAuthService({
		repository: {
			findStaffByEmail: async () => ({
				...activeStaff,
				preferredMfaMethod: null,
				totpCredentialCount: 0,
				passkeyCredentialCount: 0
			})
		},
		tokenService: {
			issueCeremonyToken: async () => 'setup-token'
		}
	});

	const result = await authService.loginWithPassword({
		email: 'admin@example.com',
		password: 'correct horse battery staple',
		userAgent: 'test-agent',
		ipAddress: '127.0.0.1'
	});

	assert.equal(result.status, 'mfa_setup_required');
});

test('confirmLoginTotpSetup stores a credential and returns an authenticated session', async () => {
	let savedPreference: { preferredMfaMethod: 'authenticator' | 'passkey' | null } | undefined;
	let savedCredential:
		| {
				staffId: string;
				secretEncrypted: string;
				digits: number;
				period: number;
				verifiedAt: Date;
				lastUsedAt: Date;
				lastUsedTimeStep: bigint;
		  }
		| undefined;
	let findStaffByIdCalls = 0;

	const authService = createTestAuthService({
		repository: {
			findStaffById: async () => {
				findStaffByIdCalls += 1;

				if (findStaffByIdCalls === 1) {
					return {
						...activeStaff,
						preferredMfaMethod: null,
						totpCredentialCount: 0,
						passkeyCredentialCount: 0
					};
				}

				return {
					...activeStaff,
					preferredMfaMethod: 'authenticator',
					totpCredentialCount: 1,
					passkeyCredentialCount: 0
				};
			},
			upsertTotpCredential: async (input) => {
				savedCredential = input;
			},
			updateMfaPreference: async (_staffId, preferences) => {
				savedPreference = preferences;
			}
		},
		tokenService: {
			verifyCeremonyToken: async <T>() =>
				({
					staffId: activeStaff.id,
					secret: 'totp-secret',
					digits: 6,
					period: 30,
					primaryFactor: 'password'
				}) as T
		}
	});

	const result = await authService.confirmLoginTotpSetup({
		setupToken: 'setup-token',
		code: '123456',
		userAgent: 'test-agent',
		ipAddress: '127.0.0.1'
	});

	assert.equal(result.status, 'authenticated');
	assert.deepEqual(savedPreference, {
		preferredMfaMethod: 'authenticator'
	});
	assert.equal(savedCredential?.staffId, activeStaff.id);
	assert.equal(savedCredential?.secretEncrypted, 'totp-secret');
});

test('listSessions only returns active, unexpired sessions', async () => {
	const now = new Date('2026-06-12T00:00:00.000Z');
	const activeSession = {
		id: 'active-session',
		staffId: activeStaff.id,
		userAgent: null,
		ipAddress: null,
		authenticatedAt: now,
		lastSeenAt: now,
		expiresAt: new Date('2026-06-13T00:00:00.000Z'),
		revokedAt: null
	};

	const authService = createTestAuthService({
		repository: {
			listSessions: async () => [
				activeSession,
				{
					...activeSession,
					id: 'expired-session',
					expiresAt: new Date('2026-06-11T00:00:00.000Z')
				},
				{ ...activeSession, id: 'revoked-session', revokedAt: now }
			]
		}
	});

	const sessions = await authService.listSessions(activeStaff.id);
	assert.deepEqual(
		sessions.map((session) => session.id),
		['active-session']
	);
});

test('password security reauthentication issues a session-bound action token when MFA is not configured', async () => {
	let payload: Record<string, unknown> | undefined;
	const authService = createTestAuthService({
		repository: {
			findStaffById: async () => ({
				...activeStaff,
				preferredMfaMethod: null,
				totpCredentialCount: 0,
				passkeyCredentialCount: 0
			})
		},
		tokenService: {
			issueCeremonyToken: async (input) => {
				payload = input as Record<string, unknown>;
				return 'security-reauth-token';
			}
		}
	});

	const token = await authService.verifySecurityPassword({
		staffId: activeStaff.id,
		sessionId: 'session-1',
		action: 'add_passkey',
		targetId: null,
		password: 'current-password'
	});

	assert.equal(token, 'security-reauth-token');
	assert.equal(payload?.['purpose'], 'security_reauth');
	assert.equal(payload?.['staffId'], activeStaff.id);
	assert.equal(payload?.['sessionId'], 'session-1');
	assert.equal(payload?.['action'], 'add_passkey');
	assert.equal(payload?.['method'], 'password');
});

test('password security reauthentication is rejected when an MFA factor is configured', async () => {
	const authService = createTestAuthService({
		repository: { findStaffById: async () => activeStaff }
	});

	await assert.rejects(
		() =>
			authService.verifySecurityPassword({
				staffId: activeStaff.id,
				sessionId: 'session-1',
				action: 'add_totp',
				targetId: null,
				password: 'current-password'
			}),
		(error: unknown) => error instanceof AppError && error.code === 'MFA_REAUTH_REQUIRED'
	);
});

test('removing the final TOTP factor is rejected', async () => {
	const authService = createTestAuthService({
		repository: {
			findStaffById: async () => activeStaff,
			deleteTotpCredential: async () => 'mfa_required'
		}
	});

	await assert.rejects(
		() => authService.removeTotp(activeStaff.id),
		(error: unknown) => error instanceof AppError && error.code === 'MFA_METHOD_REQUIRED'
	);
});

test('removing the final passkey factor is rejected', async () => {
	const authService = createTestAuthService({
		repository: {
			findStaffById: async () => ({
				...activeStaff,
				preferredMfaMethod: 'passkey',
				totpCredentialCount: 0,
				passkeyCredentialCount: 1
			}),
			deletePasskeyCredential: async () => 'mfa_required'
		}
	});

	await assert.rejects(
		() => authService.removePasskey(activeStaff.id, 'passkey-1'),
		(error: unknown) => error instanceof AppError && error.code === 'MFA_METHOD_REQUIRED'
	);
});

test('changing the password revokes other sessions and rotates the current session', async () => {
	const revoked: string[] = [];
	let updatedHash = '';
	const now = new Date('2026-06-12T00:00:00.000Z');
	const sessions = ['current-session', 'other-session'].map((id) => ({
		id,
		staffId: activeStaff.id,
		userAgent: null,
		ipAddress: null,
		authenticatedAt: now,
		lastSeenAt: null,
		expiresAt: new Date('2026-06-13T00:00:00.000Z'),
		revokedAt: null
	}));
	const authService = createTestAuthService({
		repository: {
			findStaffById: async () => activeStaff,
			listSessions: async () => sessions,
			revokeSession: async (sessionId) => {
				revoked.push(sessionId);
			},
			updatePasswordHash: async (_staffId, hash) => {
				updatedHash = hash;
			}
		},
		passwordHasher: {
			hash: async () => 'new-hash'
		}
	});

	const result = await authService.changePassword({
		staffId: activeStaff.id,
		currentSessionId: 'current-session',
		currentPassword: 'old-password',
		newPassword: 'New-password-123!',
		primaryFactor: 'password',
		mfaMethods: ['authenticator'],
		userAgent: 'browser',
		ipAddress: '127.0.0.1'
	});

	assert.equal(result.status, 'authenticated');
	assert.equal(updatedHash, 'new-hash');
	assert.deepEqual(revoked, ['other-session', 'current-session']);
});
