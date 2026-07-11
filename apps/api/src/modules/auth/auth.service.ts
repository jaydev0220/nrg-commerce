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

function deriveMfaRequirement(staff: AuthStaffRecord): 'authenticator' | 'passkey' | null {
	if (!staff.mfaRequired && staff.totpCredentialCount === 0 && staff.passkeyCredentialCount === 0) {
		return null;
	}

	if (staff.preferredMfaMethod === 'authenticator' && staff.totpCredentialCount > 0) {
		return 'authenticator';
	}

	if (staff.preferredMfaMethod === 'passkey' && staff.passkeyCredentialCount > 0) {
		return 'passkey';
	}

	if (staff.totpCredentialCount > 0) {
		return 'authenticator';
	}

	if (staff.passkeyCredentialCount > 0) {
		return 'passkey';
	}

	return null;
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

export function createAuthService(dependencies: AuthServiceDependencies) {
	const sessionTtlSeconds = dependencies.sessionTtlSeconds ?? 604_800;

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
		const sessionExpiresAt = new Date(now.getTime() + sessionTtlSeconds * 1_000);
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
		const requiredMfaMethod = deriveMfaRequirement(staff);

		if (!requiredMfaMethod) {
			throw new AppError(
				409,
				'MFA_CONFIGURATION_INVALID',
				'The staff account does not have a usable MFA method.'
			);
		}

		const pendingToken = await dependencies.tokenService.issuePendingAuthToken({
			staffId: staff.id,
			primaryFactor,
			requiredMfaMethod
		});

		return {
			status: 'mfa_required',
			method: requiredMfaMethod,
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
			mfaRequired: true,
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

			if (deriveMfaRequirement(staff)) {
				return issueMfaChallenge(staff, 'password');
			}

			return issueMfaSetupRequirement(staff, 'password');
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

			if (pendingClaims.requiredMfaMethod !== 'authenticator') {
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

		async beginPasskeyLogin(email: string): Promise<PasskeyOptionsResult> {
			const staff = ensureActiveStaff(await dependencies.repository.findStaffByEmail(email));
			const credentials = await dependencies.repository.listPasskeyCredentials(staff.id);

			if (credentials.length === 0) {
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
				staffId: staff.id,
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
				staffId: string;
				challenge: string;
				primaryFactor: 'passkey';
			}>(input.ceremonyToken, 'passkey_login');
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

			const verification = await dependencies.passkeyService.finishAuthentication(
				claims.challenge,
				input.credential,
				storedCredential
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

			if (deriveMfaRequirement(staff) === 'authenticator') {
				return issueMfaChallenge(staff, 'passkey');
			}

			return issueAuthenticatedSession(staff, {
				primaryFactor: 'passkey',
				mfaMethods: ['passkey'],
				userAgent: input.userAgent,
				ipAddress: input.ipAddress
			});
		},

		async beginPasskeyMfa(pendingToken: string): Promise<PasskeyOptionsResult> {
			const claims = await dependencies.tokenService.verifyPendingAuthToken(pendingToken);

			if (claims.requiredMfaMethod !== 'passkey') {
				throw new AppError(
					409,
					'MFA_METHOD_MISMATCH',
					'This pending authentication challenge does not require a passkey.'
				);
			}

			const staff = ensureActiveStaff(await dependencies.repository.findStaffById(claims.staffId));
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

			const verification = await dependencies.passkeyService.finishAuthentication(
				claims.challenge,
				input.credential,
				storedCredential
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
			ipAddress: string | null
		): Promise<AuthSuccessResult> {
			const claims = await dependencies.tokenService.verifyRefreshToken(refreshToken);
			const storedToken = await dependencies.repository.findRefreshToken(
				dependencies.hashRefreshToken(refreshToken)
			);

			if (!storedToken || storedToken.jwtId !== claims.jti) {
				throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh token is invalid.');
			}

			if (
				storedToken.consumedAt ||
				storedToken.revokedAt ||
				storedToken.expiresAt.getTime() <= dependencies.now().getTime()
			) {
				await dependencies.repository.revokeSession(storedToken.sessionId);
				throw new AppError(
					401,
					'INVALID_REFRESH_TOKEN',
					'The refresh token has expired or has already been used.'
				);
			}

			const staff = ensureActiveStaff(storedToken.staff);
			const now = dependencies.now();
			const nextRefreshJwtId = dependencies.createId();
			const nextRefreshTokenId = dependencies.createId();
			const nextSessionExpiry = new Date(now.getTime() + sessionTtlSeconds * 1_000);
			const nextRefreshToken = await dependencies.tokenService.issueRefreshToken({
				sub: staff.id,
				sid: claims.sid,
				jti: nextRefreshJwtId,
				mfa: claims.mfa,
				primaryFactor: claims.primaryFactor
			});

			await dependencies.repository.replaceRefreshToken({
				currentTokenHash: storedToken.tokenHash,
				newTokenId: nextRefreshTokenId,
				newJwtId: nextRefreshJwtId,
				newTokenHash: dependencies.hashRefreshToken(nextRefreshToken),
				newExpiresAt: nextSessionExpiry,
				usedAt: now
			});

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
					authenticatedAt: now,
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

		async authenticateAccessToken(accessToken: string): Promise<AuthenticatedStaffContext> {
			const claims = await dependencies.tokenService.verifyAccessToken(accessToken);
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
			return dependencies.repository.listSessions(staffId);
		},

		async revokeSession(staffId: string, sessionId: string): Promise<void> {
			const revoked = await dependencies.repository.revokeSessionForStaff(sessionId, staffId);

			if (!revoked) {
				throw new AppError(404, 'SESSION_NOT_FOUND', 'The requested session could not be found.');
			}
		},

		async updateMfaPreference(
			staffId: string,
			input: { mfaRequired: boolean; preferredMfaMethod: 'authenticator' | 'passkey' | null }
		): Promise<void> {
			const staff = ensureActiveStaff(await dependencies.repository.findStaffById(staffId));

			if (
				input.mfaRequired &&
				input.preferredMfaMethod === 'authenticator' &&
				staff.totpCredentialCount === 0
			) {
				throw new AppError(
					409,
					'MFA_NOT_CONFIGURED',
					'A verified authenticator must be configured before enabling TOTP MFA.'
				);
			}

			if (
				input.mfaRequired &&
				input.preferredMfaMethod === 'passkey' &&
				staff.passkeyCredentialCount === 0
			) {
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

		async removeTotp(staffId: string): Promise<void> {
			await dependencies.repository.deleteTotpCredential(staffId);
			await dependencies.repository.updateMfaPreference(staffId, {
				mfaRequired: false,
				preferredMfaMethod: null
			});
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
