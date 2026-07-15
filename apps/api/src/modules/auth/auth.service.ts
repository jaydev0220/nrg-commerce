import { errors as joseErrors } from 'jose';

import { AppError } from '../../errors/app-error.js';
import type { PasskeyService } from '../../utils/passkey-service.js';
import type { PasswordHasher } from '../../utils/password-hasher.js';
import type { TokenService } from '../../utils/token-service.js';
import type { TotpService } from '../../utils/totp-service.js';

import type { AuthRepository } from './auth.repository.js';
import type {
	AuthMfaChallengeResult,
	AuthMfaSetupRequiredResult,
	AuthenticatedStaffContext,
	AuthStaffRecord,
	AuthSuccessResult,
	MfaSetupTokenPayload,
	PasskeyOptionsResult,
	PasskeyRegistrationInput,
	PendingAuthPayload,
	SecurityAction,
	SecurityReauthMethod,
	TOTPSetupResult
} from '../../types/auth.js';

type AuthServiceDependencies = {
	repository: Pick<
		AuthRepository,
		| 'findStaffByEmail'
		| 'findStaffById'
		| 'findSessionById'
		| 'createSession'
		| 'findRefreshToken'
		| 'replaceRefreshToken'
		| 'revokeSession'
		| 'revokeSessionForStaff'
		| 'listSessions'
		| 'findTotpCredential'
		| 'updateMfaPreference'
		| 'upsertTotpCredential'
		| 'deleteTotpCredential'
		| 'createPasskeyCredential'
		| 'updatePasskeyCredentialCounter'
		| 'listPasskeyCredentials'
		| 'findPasskeyCredentialByCredentialId'
		| 'updatePasswordHash'
	> &
		Partial<
			Pick<
				AuthRepository,
				'findPasskeyCredentialById' | 'updatePasskeyCredentialNickname' | 'deletePasskeyCredential'
			>
		>;
	passwordHasher: Pick<PasswordHasher, 'hash' | 'verify'> & {
		needsRehash?: (digest: string) => boolean;
	};
	tokenService: TokenService;
	totpService: TotpService;
	passkeyService: PasskeyService;
	now: () => Date;
	createId: () => string;
	hashRefreshToken: (token: string) => string;
	sessionTtlSeconds?: number;
	sessionAbsoluteTtlSeconds?: number;
	recordAuthDiagnostic?: (event: { code: string; sessionId: string; requestId?: string }) => void;
};

function isStaffActive(staff: AuthStaffRecord): boolean {
	return staff.status === 'active';
}

function derivePermissions(staff: AuthStaffRecord) {
	return [...new Set(staff.roles.flatMap((role) => role.permissions))];
}

function deriveRoles(staff: AuthStaffRecord) {
	return staff.roles.map((role) => role.key);
}

function deriveMfaMethods(staff: AuthStaffRecord): Array<'authenticator' | 'passkey'> {
	const methods: Array<'authenticator' | 'passkey'> = [];
	if (staff.preferredMfaMethod === 'authenticator' && staff.totpCredentialCount > 0) {
		methods.push('authenticator');
	}
	if (staff.preferredMfaMethod === 'passkey' && staff.passkeyCredentialCount > 0) {
		methods.push('passkey');
	}
	if (staff.totpCredentialCount > 0 && !methods.includes('authenticator'))
		methods.push('authenticator');
	if (staff.passkeyCredentialCount > 0 && !methods.includes('passkey')) methods.push('passkey');
	return methods;
}

function hasVerifiedMfaCredential(staff: AuthStaffRecord): boolean {
	return staff.totpCredentialCount > 0 || staff.passkeyCredentialCount > 0;
}

function ensureActiveStaff(staff: AuthStaffRecord | null): AuthStaffRecord {
	if (!staff || !isStaffActive(staff)) {
		throw new AppError(401, 'INVALID_CREDENTIALS', 'Authentication failed.');
	}

	return staff;
}

function availableSecurityReauthMethods(staff: AuthStaffRecord): SecurityReauthMethod[] {
	const methods: SecurityReauthMethod[] = [];
	if (staff.totpCredentialCount > 0) methods.push('authenticator');
	if (staff.passkeyCredentialCount > 0) methods.push('passkey');
	if (methods.length === 0) methods.push('password');
	return methods;
}

function validateSecurityReauthTarget(
	action: SecurityAction,
	targetId?: string | null
): string | null {
	const normalizedTarget = targetId ?? null;
	if ((action === 'rename_passkey' || action === 'remove_passkey') && normalizedTarget === null) {
		throw new AppError(400, 'SECURITY_TARGET_REQUIRED', 'A passkey target is required.');
	}
	return normalizedTarget;
}

export function createAuthService(dependencies: AuthServiceDependencies) {
	const sessionTtlSeconds = dependencies.sessionTtlSeconds ?? 604_800;
	const sessionAbsoluteTtlSeconds = dependencies.sessionAbsoluteTtlSeconds ?? 2_592_000;
	const initialSessionTtlSeconds = Math.min(sessionTtlSeconds, sessionAbsoluteTtlSeconds);

	async function finishPasskeyAuthentication(
		challenge: string,
		credential: Parameters<PasskeyService['finishAuthentication']>[1],
		storedCredential: Parameters<PasskeyService['finishAuthentication']>[2],
		requireUserVerification: boolean
	) {
		try {
			return await dependencies.passkeyService.finishAuthentication(
				challenge,
				credential,
				storedCredential,
				requireUserVerification
			);
		} catch {
			throw new AppError(
				401,
				'PASSKEY_VERIFICATION_FAILED',
				'The passkey authentication could not be verified.'
			);
		}
	}

	async function issueAuthenticatedSession(
		staff: AuthStaffRecord,
		options: {
			primaryFactor: 'password' | 'passkey';
			mfaMethods: Array<'authenticator' | 'passkey'>;
			userAgent: string | null;
			ipAddress: string | null;
		}
	): Promise<AuthSuccessResult> {
		const now = dependencies.now();
		const sessionId = dependencies.createId();
		const refreshJwtId = dependencies.createId();
		const refreshTokenId = dependencies.createId();
		const sessionExpiresAt = new Date(now.getTime() + initialSessionTtlSeconds * 1_000);
		const refreshToken = await dependencies.tokenService.issueRefreshToken({
			sub: staff.id,
			sid: sessionId,
			jti: refreshJwtId,
			mfa: options.mfaMethods,
			primaryFactor: options.primaryFactor
		});

		await dependencies.repository.createSession({
			sessionId,
			staffId: staff.id,
			userAgent: options.userAgent,
			ipAddress: options.ipAddress,
			authenticatedAt: now,
			expiresAt: sessionExpiresAt,
			refreshTokenId,
			refreshJwtId,
			refreshTokenHash: dependencies.hashRefreshToken(refreshToken),
			refreshExpiresAt: sessionExpiresAt
		});

		const accessToken = await dependencies.tokenService.issueAccessToken({
			sub: staff.id,
			sid: sessionId,
			jti: dependencies.createId(),
			roles: deriveRoles(staff),
			permissions: derivePermissions(staff),
			mfa: options.mfaMethods,
			primaryFactor: options.primaryFactor
		});

		return {
			status: 'authenticated',
			accessToken,
			refreshToken,
			session: {
				id: sessionId,
				staffId: staff.id,
				userAgent: options.userAgent,
				ipAddress: options.ipAddress,
				authenticatedAt: now,
				lastSeenAt: null,
				expiresAt: sessionExpiresAt,
				revokedAt: null
			},
			staff
		};
	}

	async function issueMfaChallenge(
		staff: AuthStaffRecord,
		primaryFactor: 'password' | 'passkey'
	): Promise<AuthMfaChallengeResult> {
		const availableMfaMethods = deriveMfaMethods(staff);
		const preferredMfaMethod = availableMfaMethods[0];

		if (!preferredMfaMethod) {
			throw new AppError(
				409,
				'MFA_CONFIGURATION_INVALID',
				'The staff account does not have a usable MFA method.'
			);
		}

		const pendingToken = await dependencies.tokenService.issuePendingAuthToken({
			staffId: staff.id,
			primaryFactor,
			preferredMfaMethod,
			availableMfaMethods
		});

		return {
			status: 'mfa_required',
			method: preferredMfaMethod,
			availableMethods: availableMfaMethods,
			pendingToken
		};
	}

	async function issueMfaSetupRequirement(
		staff: AuthStaffRecord,
		primaryFactor: 'password' | 'passkey'
	): Promise<AuthMfaSetupRequiredResult> {
		const setupToken = await dependencies.tokenService.issueCeremonyToken({
			type: 'ceremony',
			purpose: 'mfa_setup',
			staffId: staff.id,
			primaryFactor
		});

		return {
			status: 'mfa_setup_required',
			setupToken,
			availableMethods: ['authenticator', 'passkey'],
			staffId: staff.id
		};
	}

	async function resolveMfaSetupToken(
		setupToken: string
	): Promise<{ staff: AuthStaffRecord; primaryFactor: 'password' | 'passkey' }> {
		const claims = await dependencies.tokenService.verifyCeremonyToken<MfaSetupTokenPayload>(
			setupToken,
			'mfa_setup'
		);
		const staff = ensureActiveStaff(await dependencies.repository.findStaffById(claims.staffId));

		if (hasVerifiedMfaCredential(staff)) {
			throw new AppError(
				409,
				'MFA_ALREADY_CONFIGURED',
				'A verified MFA credential has already been configured for this staff account.'
			);
		}

		return {
			staff,
			primaryFactor: claims.primaryFactor
		};
	}

	async function finalizeMfaSetup(
		staffId: string,
		method: 'authenticator' | 'passkey',
		options: {
			primaryFactor: 'password' | 'passkey';
			userAgent: string | null;
			ipAddress: string | null;
		}
	): Promise<AuthSuccessResult> {
		await dependencies.repository.updateMfaPreference(staffId, {
			preferredMfaMethod: method
		});
		const updatedStaff = ensureActiveStaff(await dependencies.repository.findStaffById(staffId));

		return issueAuthenticatedSession(updatedStaff, {
			primaryFactor: options.primaryFactor,
			mfaMethods: [method],
			userAgent: options.userAgent,
			ipAddress: options.ipAddress
		});
	}

	async function beginPasskeyRegistrationForStaff(
		staff: AuthStaffRecord,
		nickname: string | null,
		primaryFactor?: 'password' | 'passkey'
	): Promise<PasskeyOptionsResult> {
		const credentials = await dependencies.repository.listPasskeyCredentials(staff.id);
		if (
			nickname &&
			credentials.some(
				(credential) =>
					credential.nickname?.trim().toLocaleLowerCase() === nickname.trim().toLocaleLowerCase()
			)
		) {
			throw new AppError(409, 'PASSKEY_NAME_TAKEN', 'A passkey with this name already exists.');
		}
		const options = await dependencies.passkeyService.beginRegistration(staff, credentials);
		const ceremonyToken = await dependencies.tokenService.issueCeremonyToken({
			type: 'ceremony',
			purpose: 'passkey_registration',
			staffId: staff.id,
			challenge: options.challenge,
			nickname,
			primaryFactor
		});

		return {
			ceremonyToken,
			options
		};
	}

	return {
		async getPendingAuthState(pendingToken: string) {
			const claims = await dependencies.tokenService.verifyPendingAuthToken(pendingToken);
			return {
				status: 'mfa_required' as const,
				method: claims.preferredMfaMethod,
				availableMethods: claims.availableMfaMethods
			};
		},

		async loginWithPassword(input: {
			email: string;
			password: string;
			userAgent: string | null;
			ipAddress: string | null;
		}): Promise<AuthSuccessResult | AuthMfaChallengeResult | AuthMfaSetupRequiredResult> {
			const staff = ensureActiveStaff(await dependencies.repository.findStaffByEmail(input.email));

			if (!staff.passwordHash) {
				throw new AppError(401, 'INVALID_CREDENTIALS', 'Authentication failed.');
			}

			const isValidPassword = await dependencies.passwordHasher.verify(
				input.password,
				staff.passwordHash
			);

			if (!isValidPassword) {
				throw new AppError(401, 'INVALID_CREDENTIALS', 'Authentication failed.');
			}

			if (dependencies.passwordHasher.needsRehash?.(staff.passwordHash)) {
				await dependencies.repository.updatePasswordHash(
					staff.id,
					await dependencies.passwordHasher.hash(input.password)
				);
			}

			if (!hasVerifiedMfaCredential(staff)) {
				return issueMfaSetupRequirement(staff, 'password');
			}

			return issueMfaChallenge(staff, 'password');
		},

		async completeTotpLogin(input: {
			pendingToken: string;
			code: string;
			userAgent: string | null;
			ipAddress: string | null;
		}): Promise<AuthSuccessResult> {
			const pendingClaims = await dependencies.tokenService.verifyPendingAuthToken(
				input.pendingToken
			);

			if (!pendingClaims.availableMfaMethods.includes('authenticator')) {
				throw new AppError(
					409,
					'MFA_METHOD_MISMATCH',
					'This pending authentication challenge does not require TOTP.'
				);
			}

			const staff = ensureActiveStaff(
				await dependencies.repository.findStaffById(pendingClaims.staffId)
			);
			const credential = await dependencies.repository.findTotpCredential(staff.id);

			if (!credential) {
				throw new AppError(
					409,
					'MFA_NOT_CONFIGURED',
					'No verified authenticator credential is configured.'
				);
			}

			const secret = dependencies.totpService.decryptSecret(credential.secretEncrypted);
			const isValidCode = await dependencies.totpService.verifyCode(
				secret,
				input.code,
				credential.digits,
				credential.period
			);

			if (!isValidCode) {
				throw new AppError(401, 'INVALID_TOTP_CODE', 'The provided one-time password is invalid.');
			}

			return issueAuthenticatedSession(staff, {
				primaryFactor: pendingClaims.primaryFactor,
				mfaMethods: ['authenticator'],
				userAgent: input.userAgent,
				ipAddress: input.ipAddress
			});
		},

		async beginPasskeyLogin(email?: string): Promise<PasskeyOptionsResult> {
			const staff = email
				? ensureActiveStaff(await dependencies.repository.findStaffByEmail(email))
				: null;
			const credentials = staff
				? await dependencies.repository.listPasskeyCredentials(staff.id)
				: [];

			if (staff && credentials.length === 0) {
				throw new AppError(
					404,
					'PASSKEY_NOT_FOUND',
					'No passkey is registered for this staff account.'
				);
			}

			const options = await dependencies.passkeyService.beginAuthentication(
				credentials,
				'required'
			);
			const ceremonyToken = await dependencies.tokenService.issueCeremonyToken({
				type: 'ceremony',
				purpose: 'passkey_login',
				...(staff ? { staffId: staff.id } : {}),
				challenge: options.challenge,
				primaryFactor: 'passkey'
			});

			return {
				ceremonyToken,
				options
			};
		},

		async verifyPasskeyLogin(input: {
			ceremonyToken: string;
			credential: Parameters<PasskeyService['finishAuthentication']>[1];
			userAgent: string | null;
			ipAddress: string | null;
		}): Promise<AuthSuccessResult | AuthMfaChallengeResult | AuthMfaSetupRequiredResult> {
			const claims = await dependencies.tokenService.verifyCeremonyToken<{
				staffId?: string;
				challenge: string;
				primaryFactor: 'passkey';
			}>(input.ceremonyToken, 'passkey_login');
			const storedCredential = await dependencies.repository.findPasskeyCredentialByCredentialId(
				input.credential.id
			);

			if (!storedCredential) {
				throw new AppError(
					404,
					'PASSKEY_NOT_FOUND',
					'The provided passkey credential is not registered.'
				);
			}
			if (claims.staffId && storedCredential.staffId !== claims.staffId) {
				throw new AppError(
					401,
					'PASSKEY_VERIFICATION_FAILED',
					'The passkey authentication could not be verified.'
				);
			}
			const staff = ensureActiveStaff(
				await dependencies.repository.findStaffById(claims.staffId ?? storedCredential.staffId)
			);

			const verification = await finishPasskeyAuthentication(
				claims.challenge,
				input.credential,
				storedCredential,
				true
			);

			if (!verification.verified) {
				throw new AppError(
					401,
					'PASSKEY_VERIFICATION_FAILED',
					'The passkey authentication could not be verified.'
				);
			}

			await dependencies.repository.updatePasskeyCredentialCounter(
				storedCredential.credentialId,
				verification.authenticationInfo.newCounter,
				dependencies.now()
			);

			return issueAuthenticatedSession(staff, {
				primaryFactor: 'passkey',
				mfaMethods: ['passkey'],
				userAgent: input.userAgent,
				ipAddress: input.ipAddress
			});
		},

		async beginPasskeyMfa(pendingToken: string): Promise<PasskeyOptionsResult> {
			const claims = await dependencies.tokenService.verifyPendingAuthToken(pendingToken);

			const staff = ensureActiveStaff(await dependencies.repository.findStaffById(claims.staffId));
			if (!claims.availableMfaMethods.includes('passkey')) {
				throw new AppError(
					409,
					'MFA_METHOD_MISMATCH',
					'This pending authentication challenge does not require a passkey.'
				);
			}

			const credentials = await dependencies.repository.listPasskeyCredentials(staff.id);

			if (credentials.length === 0) {
				throw new AppError(
					409,
					'PASSKEY_NOT_FOUND',
					'No passkey is registered for this staff account.'
				);
			}

			const options = await dependencies.passkeyService.beginAuthentication(
				credentials,
				'discouraged'
			);
			const ceremonyToken = await dependencies.tokenService.issueCeremonyToken({
				type: 'ceremony',
				purpose: 'passkey_mfa',
				staffId: staff.id,
				challenge: options.challenge,
				primaryFactor: claims.primaryFactor
			});

			return {
				ceremonyToken,
				options
			};
		},

		async verifyPasskeyMfa(input: {
			ceremonyToken: string;
			credential: Parameters<PasskeyService['finishAuthentication']>[1];
			userAgent: string | null;
			ipAddress: string | null;
		}): Promise<AuthSuccessResult> {
			const claims = await dependencies.tokenService.verifyCeremonyToken<{
				staffId: string;
				challenge: string;
				primaryFactor: PendingAuthPayload['primaryFactor'];
			}>(input.ceremonyToken, 'passkey_mfa');
			const staff = ensureActiveStaff(await dependencies.repository.findStaffById(claims.staffId));
			const storedCredential = await dependencies.repository.findPasskeyCredentialByCredentialId(
				input.credential.id
			);

			if (!storedCredential) {
				throw new AppError(
					404,
					'PASSKEY_NOT_FOUND',
					'The provided passkey credential is not registered.'
				);
			}
			if (storedCredential.staffId !== claims.staffId) {
				throw new AppError(
					401,
					'PASSKEY_VERIFICATION_FAILED',
					'The passkey authentication could not be verified.'
				);
			}

			const verification = await finishPasskeyAuthentication(
				claims.challenge,
				input.credential,
				storedCredential,
				false
			);

			if (!verification.verified) {
				throw new AppError(
					401,
					'PASSKEY_VERIFICATION_FAILED',
					'The passkey authentication could not be verified.'
				);
			}

			await dependencies.repository.updatePasskeyCredentialCounter(
				storedCredential.credentialId,
				verification.authenticationInfo.newCounter,
				dependencies.now()
			);

			return issueAuthenticatedSession(staff, {
				primaryFactor: claims.primaryFactor,
				mfaMethods: ['passkey'],
				userAgent: input.userAgent,
				ipAddress: input.ipAddress
			});
		},

		async refreshSession(
			refreshToken: string,
			userAgent: string | null,
			ipAddress: string | null,
			requestId?: string
		): Promise<AuthSuccessResult> {
			const claims = await dependencies.tokenService.verifyRefreshToken(refreshToken).catch(() => {
				throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh token is invalid.');
			});
			const storedToken = await dependencies.repository.findRefreshToken(
				dependencies.hashRefreshToken(refreshToken)
			);

			if (
				!storedToken ||
				storedToken.jwtId !== claims.jti ||
				storedToken.sessionId !== claims.sid ||
				storedToken.staffId !== claims.sub
			) {
				throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh token is invalid.');
			}

			const now = dependencies.now();
			const recordDiagnostic = (code: string) => {
				try {
					dependencies.recordAuthDiagnostic?.({
						code,
						sessionId: storedToken.sessionId,
						requestId
					});
				} catch {
					// Diagnostics must never change authentication behavior.
				}
			};

			if (storedToken.consumedAt || storedToken.revokedAt || storedToken.session.revokedAt) {
				await dependencies.repository.revokeSession(storedToken.sessionId);
				recordDiagnostic('REFRESH_TOKEN_REPLAY');
				throw new AppError(
					401,
					'REFRESH_TOKEN_REPLAY',
					'The refresh token has expired or has already been used.'
				);
			}
			if (storedToken.expiresAt.getTime() <= now.getTime()) {
				await dependencies.repository.revokeSession(storedToken.sessionId);
				recordDiagnostic('SESSION_IDLE_EXPIRED');
				throw new AppError(401, 'SESSION_IDLE_EXPIRED', 'The refresh token has expired.');
			}

			const absoluteExpiry = new Date(
				storedToken.session.authenticatedAt.getTime() + sessionAbsoluteTtlSeconds * 1_000
			);
			if (absoluteExpiry.getTime() <= now.getTime()) {
				await dependencies.repository.revokeSession(storedToken.sessionId);
				recordDiagnostic('SESSION_ABSOLUTE_EXPIRED');
				throw new AppError(
					401,
					'SESSION_ABSOLUTE_EXPIRED',
					'The authenticated session has expired.'
				);
			}

			const staff = ensureActiveStaff(storedToken.staff);
			const nextRefreshJwtId = dependencies.createId();
			const nextRefreshTokenId = dependencies.createId();
			const idleExpiry = new Date(now.getTime() + sessionTtlSeconds * 1_000);
			const nextSessionExpiry = new Date(Math.min(idleExpiry.getTime(), absoluteExpiry.getTime()));
			const nextRefreshToken = await dependencies.tokenService.issueRefreshToken({
				sub: staff.id,
				sid: claims.sid,
				jti: nextRefreshJwtId,
				mfa: claims.mfa,
				primaryFactor: claims.primaryFactor
			});

			const replaced = await dependencies.repository.replaceRefreshToken({
				currentTokenHash: storedToken.tokenHash,
				newTokenId: nextRefreshTokenId,
				newJwtId: nextRefreshJwtId,
				newTokenHash: dependencies.hashRefreshToken(nextRefreshToken),
				newExpiresAt: nextSessionExpiry,
				usedAt: now,
				sessionExpiresAt: nextSessionExpiry,
				sessionLastSeenAt: now
			});
			if (!replaced) {
				await dependencies.repository.revokeSession(storedToken.sessionId);
				recordDiagnostic('REFRESH_TOKEN_REPLAY');
				throw new AppError(401, 'REFRESH_TOKEN_REPLAY', 'The refresh token has already been used.');
			}

			const accessToken = await dependencies.tokenService.issueAccessToken({
				sub: staff.id,
				sid: claims.sid,
				jti: dependencies.createId(),
				roles: deriveRoles(staff),
				permissions: derivePermissions(staff),
				mfa: claims.mfa,
				primaryFactor: claims.primaryFactor
			});

			return {
				status: 'authenticated',
				accessToken,
				refreshToken: nextRefreshToken,
				session: {
					id: claims.sid,
					staffId: staff.id,
					userAgent,
					ipAddress,
					authenticatedAt: storedToken.session.authenticatedAt,
					lastSeenAt: now,
					expiresAt: nextSessionExpiry,
					revokedAt: null
				},
				staff
			};
		},

		async logout(sessionId: string): Promise<void> {
			await dependencies.repository.revokeSession(sessionId);
		},

		async logoutWithRefreshToken(refreshToken: string): Promise<void | { sessionId: string }> {
			const claims = await dependencies.tokenService.verifyRefreshToken(refreshToken).catch(() => {
				throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh token is invalid.');
			});
			await dependencies.repository.revokeSession(claims.sid);
			return { sessionId: claims.sid };
		},

		async authenticateAccessToken(accessToken: string): Promise<AuthenticatedStaffContext> {
			let claims;
			try {
				claims = await dependencies.tokenService.verifyAccessToken(accessToken);
			} catch (error) {
				if (error instanceof joseErrors.JWTExpired) {
					throw new AppError(401, 'ACCESS_TOKEN_EXPIRED', 'The access token has expired.');
				}
				throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
			}
			const sessionRecord = await dependencies.repository.findSessionById(claims.sid);

			if (
				!sessionRecord ||
				sessionRecord.session.revokedAt ||
				sessionRecord.session.expiresAt.getTime() <= dependencies.now().getTime()
			) {
				throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
			}

			const staff = ensureActiveStaff(sessionRecord.staff);

			return {
				staffId: staff.id,
				sessionId: sessionRecord.session.id,
				roles: deriveRoles(staff),
				permissions: derivePermissions(staff),
				mfa: claims.mfa,
				primaryFactor: claims.primaryFactor,
				staff
			};
		},

		async listSessions(staffId: string) {
			const now = dependencies.now().getTime();
			const sessions = await dependencies.repository.listSessions(staffId);
			return sessions.filter((session) => !session.revokedAt && session.expiresAt.getTime() > now);
		},

		async revokeSession(
			staffId: string,
			sessionId: string,
			currentSessionId?: string
		): Promise<void> {
			if (currentSessionId && currentSessionId === sessionId) {
				throw new AppError(
					409,
					'CURRENT_SESSION_REQUIRED',
					'The current session cannot be revoked here.'
				);
			}
			const revoked = await dependencies.repository.revokeSessionForStaff(sessionId, staffId);

			if (!revoked) {
				throw new AppError(404, 'SESSION_NOT_FOUND', 'The requested session could not be found.');
			}
		},

		async updateMfaPreference(
			staffId: string,
			input: { preferredMfaMethod: 'authenticator' | 'passkey' }
		): Promise<void> {
			const staff = ensureActiveStaff(await dependencies.repository.findStaffById(staffId));

			if (input.preferredMfaMethod === 'authenticator' && staff.totpCredentialCount === 0) {
				throw new AppError(
					409,
					'MFA_NOT_CONFIGURED',
					'A verified authenticator must be configured before enabling TOTP MFA.'
				);
			}

			if (input.preferredMfaMethod === 'passkey' && staff.passkeyCredentialCount === 0) {
				throw new AppError(
					409,
					'MFA_NOT_CONFIGURED',
					'A verified passkey must be configured before enabling passkey MFA.'
				);
			}

			await dependencies.repository.updateMfaPreference(staffId, input);
		},

		async beginTotpSetup(staffId: string, label: string): Promise<TOTPSetupResult> {
			const setup = await dependencies.totpService.createSetup(label);
			const setupToken = await dependencies.tokenService.issueCeremonyToken({
				type: 'ceremony',
				purpose: 'totp_setup',
				staffId,
				secret: setup.secret,
				label,
				digits: setup.digits,
				period: setup.period
			});

			return {
				setupToken,
				secret: setup.secret,
				otpauthUrl: setup.otpauthUrl,
				digits: setup.digits,
				period: setup.period
			};
		},

		async confirmTotpSetup(staffId: string, setupToken: string, code: string): Promise<void> {
			const claims = await dependencies.tokenService.verifyCeremonyToken<{
				staffId: string;
				secret: string;
				digits: number;
				period: number;
			}>(setupToken, 'totp_setup');

			if (claims.staffId !== staffId) {
				throw new AppError(
					403,
					'FORBIDDEN',
					'The TOTP setup token does not belong to the current staff account.'
				);
			}

			const isValidCode = await dependencies.totpService.verifyCode(
				claims.secret,
				code,
				claims.digits,
				claims.period
			);

			if (!isValidCode) {
				throw new AppError(401, 'INVALID_TOTP_CODE', 'The provided one-time password is invalid.');
			}

			await dependencies.repository.upsertTotpCredential({
				staffId,
				secretEncrypted: dependencies.totpService.encryptSecret(claims.secret),
				digits: claims.digits,
				period: claims.period,
				verifiedAt: dependencies.now()
			});
		},

		async removeTotp(staffId: string): Promise<{ sessionsRevoked: boolean }> {
			const staff = ensureActiveStaff(await dependencies.repository.findStaffById(staffId));
			if (staff.totpCredentialCount === 1 && staff.passkeyCredentialCount === 0) {
				throw new AppError(
					409,
					'MFA_METHOD_REQUIRED',
					'Add another MFA method before removing the current one.'
				);
			}
			await dependencies.repository.deleteTotpCredential(staffId);
			const hasRemainingPasskey = staff.passkeyCredentialCount > 0;
			await dependencies.repository.updateMfaPreference(staffId, {
				preferredMfaMethod: hasRemainingPasskey ? 'passkey' : null
			});

			if (hasRemainingPasskey) return { sessionsRevoked: false };
			for (const session of await dependencies.repository.listSessions(staffId)) {
				if (!session.revokedAt) await dependencies.repository.revokeSession(session.id);
			}
			return { sessionsRevoked: true };
		},

		async beginPasskeyRegistration(
			staff: AuthStaffRecord,
			nickname: string | null,
			primaryFactor?: 'password' | 'passkey'
		): Promise<PasskeyOptionsResult> {
			return beginPasskeyRegistrationForStaff(staff, nickname, primaryFactor);
		},

		async finishPasskeyRegistration(staffId: string, input: PasskeyRegistrationInput) {
			const claims = await dependencies.tokenService.verifyCeremonyToken<{
				staffId: string;
				challenge: string;
				nickname: string | null;
			}>(input.ceremonyToken, 'passkey_registration');

			if (claims.staffId !== staffId) {
				throw new AppError(
					403,
					'FORBIDDEN',
					'The passkey registration token does not belong to the current staff account.'
				);
			}

			const verification = await dependencies.passkeyService.finishRegistration(
				claims.challenge,
				input.credential
			);

			if (!verification.verified) {
				throw new AppError(
					401,
					'PASSKEY_REGISTRATION_FAILED',
					'The passkey registration could not be verified.'
				);
			}

			const registrationInfo = verification.registrationInfo;

			return dependencies.repository.createPasskeyCredential({
				staffId,
				credentialId: registrationInfo.credential.id,
				publicKey: registrationInfo.credential.publicKey,
				userHandle: null,
				counter: registrationInfo.credential.counter,
				transports: input.credential.response.transports ?? [],
				aaguid: registrationInfo.aaguid,
				deviceType: registrationInfo.credentialDeviceType,
				backedUp: registrationInfo.credentialBackedUp,
				nickname: claims.nickname
			});
		},

		async verifySecurityPassword(input: {
			staffId: string;
			sessionId: string;
			action: SecurityAction;
			targetId?: string | null;
			password: string;
		}): Promise<string> {
			const staff = ensureActiveStaff(await dependencies.repository.findStaffById(input.staffId));
			if (availableSecurityReauthMethods(staff).includes('password') === false) {
				throw new AppError(
					409,
					'MFA_REAUTH_REQUIRED',
					'Use a configured MFA method to verify this action.'
				);
			}
			if (
				!staff.passwordHash ||
				!(await dependencies.passwordHasher.verify(input.password, staff.passwordHash))
			) {
				throw new AppError(401, 'INVALID_CREDENTIALS', 'The current password is invalid.');
			}
			return dependencies.tokenService.issueCeremonyToken({
				type: 'ceremony',
				purpose: 'security_reauth',
				staffId: staff.id,
				sessionId: input.sessionId,
				action: input.action,
				targetId: validateSecurityReauthTarget(input.action, input.targetId),
				method: 'password',
				verifiedAt: dependencies.now().toISOString()
			});
		},

		async verifySecurityTotp(input: {
			staffId: string;
			sessionId: string;
			action: SecurityAction;
			targetId?: string | null;
			code: string;
		}): Promise<string> {
			const staff = ensureActiveStaff(await dependencies.repository.findStaffById(input.staffId));
			if (staff.totpCredentialCount === 0) {
				throw new AppError(409, 'MFA_NOT_CONFIGURED', 'No authenticator is configured.');
			}
			const credential = await dependencies.repository.findTotpCredential(staff.id);
			if (!credential)
				throw new AppError(409, 'MFA_NOT_CONFIGURED', 'No authenticator is configured.');
			const isValid = await dependencies.totpService.verifyCode(
				dependencies.totpService.decryptSecret(credential.secretEncrypted),
				input.code,
				credential.digits,
				credential.period
			);
			if (!isValid)
				throw new AppError(401, 'INVALID_TOTP_CODE', 'The one-time password is invalid.');
			return dependencies.tokenService.issueCeremonyToken({
				type: 'ceremony',
				purpose: 'security_reauth',
				staffId: staff.id,
				sessionId: input.sessionId,
				action: input.action,
				targetId: validateSecurityReauthTarget(input.action, input.targetId),
				method: 'authenticator',
				verifiedAt: dependencies.now().toISOString()
			});
		},

		async beginSecurityPasskeyReauth(input: {
			staffId: string;
			sessionId: string;
			action: SecurityAction;
			targetId?: string | null;
		}): Promise<PasskeyOptionsResult> {
			const staff = ensureActiveStaff(await dependencies.repository.findStaffById(input.staffId));
			if (staff.passkeyCredentialCount === 0) {
				throw new AppError(409, 'MFA_NOT_CONFIGURED', 'No passkey is configured.');
			}
			const credentials = await dependencies.repository.listPasskeyCredentials(staff.id);
			const options = await dependencies.passkeyService.beginAuthentication(
				credentials,
				'required'
			);
			const ceremonyToken = await dependencies.tokenService.issueCeremonyToken({
				type: 'ceremony',
				purpose: 'security_reauth',
				staffId: staff.id,
				sessionId: input.sessionId,
				action: input.action,
				targetId: validateSecurityReauthTarget(input.action, input.targetId),
				method: 'passkey',
				challenge: options.challenge
			});
			return { ceremonyToken, options };
		},

		async verifySecurityPasskeyReauth(input: {
			staffId: string;
			sessionId: string;
			ceremonyToken: string;
			credential: Parameters<PasskeyService['finishAuthentication']>[1];
		}): Promise<string> {
			const claims = await dependencies.tokenService.verifyCeremonyToken<{
				staffId: string;
				sessionId: string;
				action: SecurityAction;
				targetId: string | null;
				method: 'passkey';
				challenge: string;
			}>(input.ceremonyToken, 'security_reauth');
			if (
				claims.staffId !== input.staffId ||
				claims.sessionId !== input.sessionId ||
				claims.method !== 'passkey'
			) {
				throw new AppError(
					403,
					'FORBIDDEN',
					'The security verification does not belong to this session.'
				);
			}
			const credential = await dependencies.repository.findPasskeyCredentialByCredentialId(
				input.credential.id
			);
			if (!credential || credential.staffId !== input.staffId) {
				throw new AppError(
					401,
					'PASSKEY_VERIFICATION_FAILED',
					'The passkey could not be verified.'
				);
			}
			const verification = await finishPasskeyAuthentication(
				claims.challenge,
				input.credential,
				credential,
				true
			);
			if (!verification.verified) {
				throw new AppError(
					401,
					'PASSKEY_VERIFICATION_FAILED',
					'The passkey could not be verified.'
				);
			}
			await dependencies.repository.updatePasskeyCredentialCounter(
				credential.credentialId,
				verification.authenticationInfo.newCounter,
				dependencies.now()
			);
			return dependencies.tokenService.issueCeremonyToken({
				type: 'ceremony',
				purpose: 'security_reauth',
				staffId: input.staffId,
				sessionId: input.sessionId,
				action: claims.action,
				targetId: validateSecurityReauthTarget(claims.action, claims.targetId),
				method: 'passkey',
				verifiedAt: dependencies.now().toISOString()
			});
		},

		async assertSecurityReauth(input: {
			token: string;
			staffId: string;
			sessionId: string;
			action: SecurityAction;
			targetId?: string | null;
		}): Promise<void> {
			const claims = await dependencies.tokenService.verifyCeremonyToken<{
				staffId: string;
				sessionId: string;
				action: SecurityAction;
				targetId: string | null;
				method: SecurityReauthMethod;
				verifiedAt?: string;
			}>(input.token, 'security_reauth');
			if (
				!claims.verifiedAt ||
				claims.staffId !== input.staffId ||
				claims.sessionId !== input.sessionId ||
				claims.action !== input.action ||
				claims.targetId !== validateSecurityReauthTarget(input.action, input.targetId)
			) {
				throw new AppError(403, 'SECURITY_REAUTH_REQUIRED', 'Verify this security action first.');
			}
		},

		async listPasskeys(staffId: string) {
			const credentials = await dependencies.repository.listPasskeyCredentials(staffId);
			return credentials.map((credential) => ({
				id: credential.id,
				nickname: credential.nickname,
				deviceType: credential.deviceType,
				backedUp: credential.backedUp,
				verifiedAt: credential.verifiedAt,
				lastUsedAt: credential.lastUsedAt
			}));
		},

		async renamePasskey(staffId: string, passkeyId: string, nickname: string): Promise<unknown> {
			const credentials = await dependencies.repository.listPasskeyCredentials(staffId);
			if (!credentials.some((credential) => credential.id === passkeyId)) {
				throw new AppError(404, 'PASSKEY_NOT_FOUND', 'The passkey could not be found.');
			}
			if (
				credentials.some(
					(credential) =>
						credential.id !== passkeyId &&
						credential.nickname?.toLocaleLowerCase() === nickname.toLocaleLowerCase()
				)
			) {
				throw new AppError(409, 'PASSKEY_NAME_TAKEN', 'A passkey with this name already exists.');
			}
			if (!dependencies.repository.updatePasskeyCredentialNickname) {
				throw new AppError(501, 'NOT_IMPLEMENTED', 'Passkey name changes are not available.');
			}
			const updated = await dependencies.repository.updatePasskeyCredentialNickname(
				staffId,
				passkeyId,
				nickname
			);
			if (!updated) throw new AppError(404, 'PASSKEY_NOT_FOUND', 'The passkey could not be found.');
			return {
				id: updated.id,
				nickname: updated.nickname,
				deviceType: updated.deviceType,
				backedUp: updated.backedUp,
				verifiedAt: updated.verifiedAt,
				lastUsedAt: updated.lastUsedAt
			};
		},

		async removePasskey(staffId: string, passkeyId: string): Promise<{ sessionsRevoked: boolean }> {
			const staff = ensureActiveStaff(await dependencies.repository.findStaffById(staffId));
			if (!dependencies.repository.deletePasskeyCredential) {
				throw new AppError(501, 'NOT_IMPLEMENTED', 'Passkey removal is not available.');
			}
			const credentials = await dependencies.repository.listPasskeyCredentials(staffId);
			if (!credentials.some((credential) => credential.id === passkeyId)) {
				throw new AppError(404, 'PASSKEY_NOT_FOUND', 'The passkey could not be found.');
			}
			if (credentials.length === 1 && staff.totpCredentialCount === 0) {
				throw new AppError(
					409,
					'MFA_METHOD_REQUIRED',
					'Add another MFA method before removing the current one.'
				);
			}
			const deleted = await dependencies.repository.deletePasskeyCredential(staffId, passkeyId);
			if (!deleted) throw new AppError(404, 'PASSKEY_NOT_FOUND', 'The passkey could not be found.');
			const hasRemainingPasskey = credentials.length > 1;
			const hasRemainingTotp = staff.totpCredentialCount > 0;
			if (hasRemainingPasskey || hasRemainingTotp) {
				await dependencies.repository.updateMfaPreference(staffId, {
					preferredMfaMethod: hasRemainingPasskey ? 'passkey' : 'authenticator'
				});
				return { sessionsRevoked: false };
			}
			await dependencies.repository.updateMfaPreference(staffId, {
				preferredMfaMethod: null
			});
			for (const session of await dependencies.repository.listSessions(staffId)) {
				if (!session.revokedAt) await dependencies.repository.revokeSession(session.id);
			}
			return { sessionsRevoked: true };
		},

		async changePassword(input: {
			staffId: string;
			currentSessionId: string;
			currentPassword: string;
			newPassword: string;
			primaryFactor: 'password' | 'passkey';
			mfaMethods: Array<'authenticator' | 'passkey'>;
			userAgent: string | null;
			ipAddress: string | null;
		}): Promise<AuthSuccessResult> {
			const staff = ensureActiveStaff(await dependencies.repository.findStaffById(input.staffId));
			if (
				!staff.passwordHash ||
				!(await dependencies.passwordHasher.verify(input.currentPassword, staff.passwordHash))
			) {
				throw new AppError(401, 'INVALID_CREDENTIALS', 'The current password is invalid.');
			}
			await dependencies.repository.updatePasswordHash(
				staff.id,
				await dependencies.passwordHasher.hash(input.newPassword)
			);
			for (const session of await dependencies.repository.listSessions(staff.id)) {
				if (!session.revokedAt && session.id !== input.currentSessionId) {
					await dependencies.repository.revokeSession(session.id);
				}
			}
			const result = await issueAuthenticatedSession(staff, {
				primaryFactor: input.primaryFactor,
				mfaMethods: input.mfaMethods,
				userAgent: input.userAgent,
				ipAddress: input.ipAddress
			});
			await dependencies.repository.revokeSession(input.currentSessionId);
			return result;
		},

		async revokeOtherSessions(staffId: string, currentSessionId: string): Promise<number> {
			let count = 0;
			for (const session of await dependencies.repository.listSessions(staffId)) {
				if (!session.revokedAt && session.id !== currentSessionId) {
					await dependencies.repository.revokeSession(session.id);
					count += 1;
				}
			}
			return count;
		},

		async beginLoginTotpSetup(setupToken: string): Promise<TOTPSetupResult> {
			const { staff, primaryFactor } = await resolveMfaSetupToken(setupToken);
			const setup = await dependencies.totpService.createSetup(staff.email);
			const enrollmentToken = await dependencies.tokenService.issueCeremonyToken({
				type: 'ceremony',
				purpose: 'totp_setup',
				staffId: staff.id,
				secret: setup.secret,
				label: staff.email,
				digits: setup.digits,
				period: setup.period,
				primaryFactor
			});

			return {
				setupToken: enrollmentToken,
				secret: setup.secret,
				otpauthUrl: setup.otpauthUrl,
				digits: setup.digits,
				period: setup.period
			};
		},

		async confirmLoginTotpSetup(input: {
			setupToken: string;
			code: string;
			userAgent: string | null;
			ipAddress: string | null;
		}): Promise<AuthSuccessResult> {
			const claims = await dependencies.tokenService.verifyCeremonyToken<{
				staffId: string;
				secret: string;
				digits: number;
				period: number;
				primaryFactor: 'password' | 'passkey';
			}>(input.setupToken, 'totp_setup');
			const staff = ensureActiveStaff(await dependencies.repository.findStaffById(claims.staffId));

			if (hasVerifiedMfaCredential(staff)) {
				throw new AppError(
					409,
					'MFA_ALREADY_CONFIGURED',
					'A verified MFA credential has already been configured for this staff account.'
				);
			}

			const isValidCode = await dependencies.totpService.verifyCode(
				claims.secret,
				input.code,
				claims.digits,
				claims.period
			);

			if (!isValidCode) {
				throw new AppError(401, 'INVALID_TOTP_CODE', 'The provided one-time password is invalid.');
			}

			await dependencies.repository.upsertTotpCredential({
				staffId: staff.id,
				secretEncrypted: dependencies.totpService.encryptSecret(claims.secret),
				digits: claims.digits,
				period: claims.period,
				verifiedAt: dependencies.now()
			});

			return finalizeMfaSetup(staff.id, 'authenticator', {
				primaryFactor: claims.primaryFactor,
				userAgent: input.userAgent,
				ipAddress: input.ipAddress
			});
		},

		async beginLoginPasskeySetup(
			setupToken: string,
			nickname: string | null
		): Promise<PasskeyOptionsResult> {
			const { staff, primaryFactor } = await resolveMfaSetupToken(setupToken);

			return beginPasskeyRegistrationForStaff(staff, nickname, primaryFactor);
		},

		async finishLoginPasskeySetup(input: {
			ceremonyToken: string;
			credential: PasskeyRegistrationInput['credential'];
			userAgent: string | null;
			ipAddress: string | null;
		}): Promise<AuthSuccessResult> {
			const claims = await dependencies.tokenService.verifyCeremonyToken<{
				staffId: string;
				challenge: string;
				nickname: string | null;
				primaryFactor: 'password' | 'passkey';
			}>(input.ceremonyToken, 'passkey_registration');
			const staff = ensureActiveStaff(await dependencies.repository.findStaffById(claims.staffId));

			if (hasVerifiedMfaCredential(staff)) {
				throw new AppError(
					409,
					'MFA_ALREADY_CONFIGURED',
					'A verified MFA credential has already been configured for this staff account.'
				);
			}

			const verification = await dependencies.passkeyService.finishRegistration(
				claims.challenge,
				input.credential
			);

			if (!verification.verified) {
				throw new AppError(
					401,
					'PASSKEY_REGISTRATION_FAILED',
					'The passkey registration could not be verified.'
				);
			}

			const registrationInfo = verification.registrationInfo;

			await dependencies.repository.createPasskeyCredential({
				staffId: staff.id,
				credentialId: registrationInfo.credential.id,
				publicKey: registrationInfo.credential.publicKey,
				userHandle: null,
				counter: registrationInfo.credential.counter,
				transports: input.credential.response.transports ?? [],
				aaguid: registrationInfo.aaguid,
				deviceType: registrationInfo.credentialDeviceType,
				backedUp: registrationInfo.credentialBackedUp,
				nickname: claims.nickname
			});

			return finalizeMfaSetup(staff.id, 'passkey', {
				primaryFactor: claims.primaryFactor,
				userAgent: input.userAgent,
				ipAddress: input.ipAddress
			});
		}
	};
}

export type AuthService = ReturnType<typeof createAuthService>;
