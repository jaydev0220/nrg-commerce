import type { Request, RequestHandler, Response } from 'express';

import { AppError } from '../../errors/app-error.js';
import { requireAuthContext } from '../../middlewares/authenticate.js';
import { getRequestContext, getRequestPath } from '../../middlewares/request-context.js';
import { getValidatedBody, getValidatedParams } from '../../middlewares/validate-request.js';
import {
	getPublicAuthResult,
	getPublicPasskeyOptions,
	getPublicTotpSetup,
	type AuthCookieManager
} from '../../utils/auth-cookies.js';
import type { LogService } from '../management/log/log.service.js';
import type { AuthService } from './auth.service.js';

type AuthControllerDependencies = {
	authService: AuthService;
	authCookies: AuthCookieManager;
	logService: Pick<LogService, 'recordAuditLog'>;
};

type PasswordLoginBody = Omit<
	Parameters<AuthService['loginWithPassword']>[0],
	'userAgent' | 'ipAddress'
>;
type PasskeyLoginBody = Pick<Parameters<AuthService['verifyPasskeyLogin']>[0], 'credential'>;
type TotpLoginBody = Pick<Parameters<AuthService['completeTotpLogin']>[0], 'code'>;
type PasskeyMfaBody = Pick<Parameters<AuthService['verifyPasskeyMfa']>[0], 'credential'>;
type SessionParams = { sessionId: string };
type MfaPreferenceBody = Parameters<AuthService['updateMfaPreference']>[1];
type TotpSetupConfirmationBody = { code: string };
type SetupPasskeyStartBody = { nickname?: string };
type PasskeyRegistrationStartBody = { nickname?: string };
type PasskeyRegistrationBody = Pick<
	Parameters<AuthService['finishPasskeyRegistration']>[1],
	'credential'
>;
type SecurityPasskeyBody = Pick<
	Parameters<AuthService['verifySecurityPasskeyReauth']>[0],
	'credential'
>;
type SecurityReauthContextBody = Pick<
	Parameters<AuthService['verifySecurityPassword']>[0],
	'action' | 'targetId'
>;
type SecurityReauthPasswordBody = Parameters<AuthService['verifySecurityPassword']>[0];
type SecurityReauthTotpBody = Parameters<AuthService['verifySecurityTotp']>[0];
type SecurityReauthOptionsBody = SecurityReauthContextBody;
type PasskeyParams = { passkeyId: string };
type PasswordChangeBody = Pick<
	Parameters<AuthService['changePassword']>[0],
	'currentPassword' | 'newPassword'
>;

type AuthController = {
	loginWithPassword: RequestHandler;
	beginPasskeyLogin: RequestHandler;
	verifyPasskeyLogin: RequestHandler;
	completeTotpLogin: RequestHandler;
	beginPasskeyMfa: RequestHandler;
	verifyPasskeyMfa: RequestHandler;
	beginLoginTotpSetup: RequestHandler;
	confirmLoginTotpSetup: RequestHandler;
	beginLoginPasskeySetup: RequestHandler;
	finishLoginPasskeySetup: RequestHandler;
	refreshSession: RequestHandler;
	logout: RequestHandler;
	getAuthState: RequestHandler;
	getCurrentStaff: RequestHandler;
	listSessions: RequestHandler;
	revokeSession: RequestHandler;
	updateMfaPreference: RequestHandler;
	beginTotpSetup: RequestHandler;
	confirmTotpSetup: RequestHandler;
	removeTotp: RequestHandler;
	beginPasskeyRegistration: RequestHandler;
	finishPasskeyRegistration: RequestHandler;
	revokeOtherSessions: RequestHandler;
	changePassword: RequestHandler;
	verifySecurityPassword: RequestHandler;
	verifySecurityTotp: RequestHandler;
	beginSecurityPasskeyReauth: RequestHandler;
	verifySecurityPasskeyReauth: RequestHandler;
	listPasskeys: RequestHandler;
	renamePasskey: RequestHandler;
	removePasskey: RequestHandler;
};

function getRequestMetadata(request: Request) {
	return {
		userAgent: request.get('user-agent')?.slice(0, 512) ?? null,
		ipAddress: request.ip?.slice(0, 64) ?? null
	};
}

function requireFlowToken(token: string | null): string {
	if (!token) {
		throw new AppError(401, 'AUTH_FLOW_EXPIRED', 'The authentication flow has expired.');
	}
	return token;
}

function requireSecurityReauthToken(
	dependencies: AuthControllerDependencies,
	request: Request,
	response: Response,
	action: Parameters<AuthService['assertSecurityReauth']>[0]['action'],
	targetId?: string | null
): Promise<void> {
	const authContext = requireAuthContext(response);
	const token = dependencies.authCookies.readSecurityReauthToken(request);
	if (!token) {
		throw new AppError(403, 'SECURITY_REAUTH_REQUIRED', 'Verify this security action first.');
	}
	return dependencies.authService.assertSecurityReauth({
		token,
		staffId: authContext.staffId,
		sessionId: authContext.sessionId,
		action,
		targetId
	});
}

async function recordAuditLog(
	dependencies: AuthControllerDependencies,
	request: Request,
	response: Response,
	entry: Omit<Parameters<LogService['recordAuditLog']>[0], 'requestId' | 'method' | 'path'>
): Promise<void> {
	const requestContext = getRequestContext(request, response);
	await dependencies.logService.recordAuditLog({
		...entry,
		requestId: requestContext.requestId,
		method: request.method,
		path: getRequestPath(request)
	});
}

function getPublicStaff(staff: ReturnType<typeof requireAuthContext>['staff']) {
	return {
		id: staff.id,
		email: staff.email,
		name: staff.name,
		status: staff.status,
		preferredMfaMethod: staff.preferredMfaMethod,
		lastLoginAt: staff.lastLoginAt,
		roles: staff.roles,
		totpCredentialCount: staff.totpCredentialCount,
		passkeyCredentialCount: staff.passkeyCredentialCount
	};
}

function getPublicPasskey(credential: {
	id: string;
	nickname: string | null;
	deviceType: 'singleDevice' | 'multiDevice' | null;
	backedUp: boolean | null;
	verifiedAt: Date | null;
	lastUsedAt: Date | null;
}) {
	return {
		id: credential.id,
		nickname: credential.nickname,
		deviceType: credential.deviceType,
		backedUp: credential.backedUp,
		verifiedAt: credential.verifiedAt,
		lastUsedAt: credential.lastUsedAt
	};
}

export function createAuthController(dependencies: AuthControllerDependencies) {
	const controller: AuthController = {
		loginWithPassword: async (request, response) => {
			const body = getValidatedBody<PasswordLoginBody>(request);
			const result = await dependencies.authService.loginWithPassword({
				email: body.email,
				password: body.password,
				...getRequestMetadata(request)
			});
			dependencies.authCookies.applyAuthResult(response, result);
			if (result.status === 'authenticated') {
				await recordAuditLog(dependencies, request, response, {
					message: 'Staff logged in with password.',
					actorStaffId: result.staff.id,
					statusCode: 200,
					entityType: 'auth_session',
					entityId: result.session.id,
					metadata: { primaryFactor: 'password' }
				});
			}
			response
				.status(result.status === 'authenticated' ? 200 : 202)
				.json(getPublicAuthResult(result));
		},

		beginPasskeyLogin: async (_request, response) => {
			const result = await dependencies.authService.beginPasskeyLogin();
			dependencies.authCookies.setCeremonyToken(response, result.ceremonyToken);
			response.status(200).json(getPublicPasskeyOptions(result));
		},

		verifyPasskeyLogin: async (request, response) => {
			const body = getValidatedBody<PasskeyLoginBody>(request);
			const result = await dependencies.authService.verifyPasskeyLogin({
				ceremonyToken: requireFlowToken(dependencies.authCookies.readCeremonyToken(request)),
				credential: body.credential,
				...getRequestMetadata(request)
			});
			dependencies.authCookies.applyAuthResult(response, result);
			if (result.status === 'authenticated') {
				await recordAuditLog(dependencies, request, response, {
					message: 'Staff logged in with passkey.',
					actorStaffId: result.staff.id,
					statusCode: 200,
					entityType: 'auth_session',
					entityId: result.session.id,
					metadata: { primaryFactor: 'passkey' }
				});
			}
			response
				.status(result.status === 'authenticated' ? 200 : 202)
				.json(getPublicAuthResult(result));
		},

		completeTotpLogin: async (request, response) => {
			const body = getValidatedBody<TotpLoginBody>(request);
			const result = await dependencies.authService.completeTotpLogin({
				pendingToken: requireFlowToken(dependencies.authCookies.readPendingToken(request)),
				code: body.code,
				...getRequestMetadata(request)
			});
			dependencies.authCookies.applyAuthResult(response, result);
			await recordAuditLog(dependencies, request, response, {
				message: 'Staff completed TOTP login.',
				actorStaffId: result.staff.id,
				statusCode: 200,
				entityType: 'auth_session',
				entityId: result.session.id,
				metadata: { mfa: 'authenticator' }
			});
			response.status(200).json(getPublicAuthResult(result));
		},

		beginPasskeyMfa: async (request, response) => {
			const result = await dependencies.authService.beginPasskeyMfa(
				requireFlowToken(dependencies.authCookies.readPendingToken(request))
			);
			dependencies.authCookies.setCeremonyToken(response, result.ceremonyToken);
			response.status(200).json(getPublicPasskeyOptions(result));
		},

		verifyPasskeyMfa: async (request, response) => {
			const body = getValidatedBody<PasskeyMfaBody>(request);
			const result = await dependencies.authService.verifyPasskeyMfa({
				ceremonyToken: requireFlowToken(dependencies.authCookies.readCeremonyToken(request)),
				credential: body.credential,
				...getRequestMetadata(request)
			});
			dependencies.authCookies.applyAuthResult(response, result);
			await recordAuditLog(dependencies, request, response, {
				message: 'Staff completed passkey MFA.',
				actorStaffId: result.staff.id,
				statusCode: 200,
				entityType: 'auth_session',
				entityId: result.session.id,
				metadata: { mfa: 'passkey' }
			});
			response.status(200).json(getPublicAuthResult(result));
		},

		beginLoginTotpSetup: async (request, response) => {
			const result = await dependencies.authService.beginLoginTotpSetup(
				requireFlowToken(dependencies.authCookies.readSetupToken(request))
			);
			dependencies.authCookies.setSetupToken(response, result.setupToken);
			response.status(200).json(getPublicTotpSetup(result));
		},

		confirmLoginTotpSetup: async (request, response) => {
			const body = getValidatedBody<TotpSetupConfirmationBody>(request);
			const result = await dependencies.authService.confirmLoginTotpSetup({
				setupToken: requireFlowToken(dependencies.authCookies.readSetupToken(request)),
				code: body.code,
				...getRequestMetadata(request)
			});
			dependencies.authCookies.applyAuthResult(response, result);
			await recordAuditLog(dependencies, request, response, {
				message: 'Staff completed initial TOTP setup.',
				actorStaffId: result.staff.id,
				statusCode: 200,
				entityType: 'totp_credential',
				entityId: result.staff.id,
				metadata: { mfa: 'authenticator', source: 'login_setup' }
			});
			response.status(200).json(getPublicAuthResult(result));
		},

		beginLoginPasskeySetup: async (request, response) => {
			const body = getValidatedBody<SetupPasskeyStartBody>(request);
			const result = await dependencies.authService.beginLoginPasskeySetup(
				requireFlowToken(dependencies.authCookies.readSetupToken(request)),
				body.nickname ?? null
			);
			dependencies.authCookies.setCeremonyToken(response, result.ceremonyToken);
			response.status(200).json(getPublicPasskeyOptions(result));
		},

		finishLoginPasskeySetup: async (request, response) => {
			const body = getValidatedBody<PasskeyRegistrationBody>(request);
			const result = await dependencies.authService.finishLoginPasskeySetup({
				ceremonyToken: requireFlowToken(dependencies.authCookies.readCeremonyToken(request)),
				credential: body.credential,
				...getRequestMetadata(request)
			});
			dependencies.authCookies.applyAuthResult(response, result);
			await recordAuditLog(dependencies, request, response, {
				message: 'Staff completed initial passkey setup.',
				actorStaffId: result.staff.id,
				statusCode: 200,
				entityType: 'passkey_credential',
				entityId: result.staff.id,
				metadata: { mfa: 'passkey', source: 'login_setup' }
			});
			response.status(200).json(getPublicAuthResult(result));
		},

		refreshSession: async (request, response) => {
			try {
				const requestContext = getRequestContext(request, response);
				const metadata = getRequestMetadata(request);
				const result = await dependencies.authService.refreshSession(
					requireFlowToken(dependencies.authCookies.readRefreshToken(request)),
					metadata.userAgent,
					metadata.ipAddress,
					requestContext.requestId
				);
				dependencies.authCookies.applyAuthResult(response, result);
				response.status(200).json(getPublicAuthResult(result));
			} catch (error) {
				if (error instanceof AppError && error.statusCode === 401) {
					dependencies.authCookies.clearSession(response);
				}
				throw error;
			}
		},

		logout: async (request, response) => {
			const refreshToken = dependencies.authCookies.readRefreshToken(request);
			let sessionId: string | undefined;
			try {
				if (refreshToken) {
					const result = await dependencies.authService.logoutWithRefreshToken(refreshToken);
					sessionId = result && 'sessionId' in result ? result.sessionId : undefined;
				}
			} catch (error) {
				if (!(error instanceof AppError && error.statusCode === 401)) {
					dependencies.authCookies.clearSession(response);
					throw new AppError(
						503,
						'AUTH_LOGOUT_FAILED',
						'Unable to revoke the authenticated session. Try again.'
					);
				}
			}
			dependencies.authCookies.clearSession(response);
			if (sessionId) {
				const requestContext = getRequestContext(request, response);
				await dependencies.logService.recordAuditLog({
					message: 'Staff logged out.',
					actorStaffId: null,
					requestId: requestContext.requestId,
					method: request.method,
					path: getRequestPath(request),
					statusCode: 204,
					entityType: 'auth_session',
					entityId: sessionId
				});
			}
			response.status(204).send();
		},

		getAuthState: async (request, response) => {
			const accessToken = dependencies.authCookies.readAccessToken(request);
			if (accessToken) {
				try {
					await dependencies.authService.authenticateAccessToken(accessToken);
					response.status(200).json({ status: 'authenticated' });
					return;
				} catch {
					// The refresh cookie may still be able to rotate an expired access token.
				}
			}
			const pendingToken = dependencies.authCookies.readPendingToken(request);
			if (pendingToken) {
				try {
					response
						.status(200)
						.json(await dependencies.authService.getPendingAuthState(pendingToken));
					return;
				} catch {
					// Expired pending tokens fall through to the normal unauthenticated state.
				}
			}
			response.status(200).json(dependencies.authCookies.readFlowState(request, false));
		},

		getCurrentStaff: (_request, response) => {
			const authContext = requireAuthContext(response);
			response.status(200).json({
				staff: getPublicStaff(authContext.staff),
				sessionId: authContext.sessionId,
				mfaMethods: authContext.mfa
			});
		},

		listSessions: async (_request, response) => {
			const authContext = requireAuthContext(response);
			const sessions = await dependencies.authService.listSessions(authContext.staffId);
			response.status(200).json({ data: sessions });
		},

		revokeSession: async (request, response) => {
			const params = getValidatedParams<SessionParams>(request);
			const authContext = requireAuthContext(response);
			await dependencies.authService.revokeSession(
				authContext.staffId,
				params.sessionId,
				authContext.sessionId
			);
			await recordAuditLog(dependencies, request, response, {
				message: 'Staff revoked an authentication session.',
				actorStaffId: authContext.staffId,
				statusCode: 204,
				entityType: 'auth_session',
				entityId: params.sessionId
			});
			response.status(204).send();
		},

		updateMfaPreference: async (request, response) => {
			const body = getValidatedBody<MfaPreferenceBody>(request);
			const authContext = requireAuthContext(response);
			await dependencies.authService.updateMfaPreference(authContext.staffId, body);
			await recordAuditLog(dependencies, request, response, {
				message: 'Staff updated MFA preferences.',
				actorStaffId: authContext.staffId,
				statusCode: 204,
				entityType: 'mfa_preference',
				entityId: authContext.staffId,
				metadata: {
					preferredMfaMethod: body.preferredMfaMethod
				}
			});
			response.status(204).send();
		},

		beginTotpSetup: async (request, response) => {
			const authContext = requireAuthContext(response);
			await requireSecurityReauthToken(dependencies, request, response, 'add_totp');
			const result = await dependencies.authService.beginTotpSetup(
				authContext.staffId,
				authContext.staff.email
			);
			dependencies.authCookies.setSetupToken(response, result.setupToken);
			response.status(200).json(getPublicTotpSetup(result));
		},

		confirmTotpSetup: async (request, response) => {
			const body = getValidatedBody<TotpSetupConfirmationBody>(request);
			const authContext = requireAuthContext(response);
			await requireSecurityReauthToken(dependencies, request, response, 'add_totp');
			await dependencies.authService.confirmTotpSetup(
				authContext.staffId,
				requireFlowToken(dependencies.authCookies.readSetupToken(request)),
				body.code
			);
			dependencies.authCookies.clearSetupToken(response);
			dependencies.authCookies.clearSecurityReauthToken(response);
			await recordAuditLog(dependencies, request, response, {
				message: 'Staff configured TOTP.',
				actorStaffId: authContext.staffId,
				statusCode: 204,
				entityType: 'totp_credential',
				entityId: authContext.staffId
			});
			response.status(204).send();
		},

		removeTotp: async (request, response) => {
			const authContext = requireAuthContext(response);
			await requireSecurityReauthToken(dependencies, request, response, 'remove_totp');
			const result = await dependencies.authService.removeTotp(authContext.staffId);
			if (result.sessionsRevoked) dependencies.authCookies.clearSession(response);
			else dependencies.authCookies.clearSecurityReauthToken(response);
			await recordAuditLog(dependencies, request, response, {
				message: 'Staff removed TOTP.',
				actorStaffId: authContext.staffId,
				statusCode: 204,
				entityType: 'totp_credential',
				entityId: authContext.staffId
			});
			response.status(204).send();
		},

		beginPasskeyRegistration: async (request, response) => {
			const body = getValidatedBody<PasskeyRegistrationStartBody>(request);
			const authContext = requireAuthContext(response);
			await requireSecurityReauthToken(dependencies, request, response, 'add_passkey');
			const result = await dependencies.authService.beginPasskeyRegistration(
				authContext.staff,
				body.nickname ?? null,
				authContext.primaryFactor
			);
			dependencies.authCookies.setCeremonyToken(response, result.ceremonyToken);
			response.status(200).json(getPublicPasskeyOptions(result));
		},

		finishPasskeyRegistration: async (request, response) => {
			const body = getValidatedBody<PasskeyRegistrationBody>(request);
			const authContext = requireAuthContext(response);
			await requireSecurityReauthToken(dependencies, request, response, 'add_passkey');
			const result = await dependencies.authService.finishPasskeyRegistration(authContext.staffId, {
				ceremonyToken: requireFlowToken(dependencies.authCookies.readCeremonyToken(request)),
				credential: body.credential
			});
			dependencies.authCookies.clearCeremonyToken(response);
			dependencies.authCookies.clearSecurityReauthToken(response);
			await recordAuditLog(dependencies, request, response, {
				message: 'Staff registered a passkey.',
				actorStaffId: authContext.staffId,
				statusCode: 201,
				entityType: 'passkey_credential',
				entityId: result.id
			});
			response.status(201).json(getPublicPasskey(result));
		},

		revokeOtherSessions: async (request, response) => {
			const authContext = requireAuthContext(response);
			const count = await dependencies.authService.revokeOtherSessions(
				authContext.staffId,
				authContext.sessionId
			);
			await recordAuditLog(dependencies, request, response, {
				message: 'Staff revoked other authentication sessions.',
				actorStaffId: authContext.staffId,
				statusCode: 200,
				entityType: 'auth_session',
				entityId: authContext.staffId,
				metadata: { revokedCount: count }
			});
			response.status(200).json({ revokedCount: count });
		},

		changePassword: async (request, response) => {
			const body = getValidatedBody<PasswordChangeBody>(request);
			const authContext = requireAuthContext(response);
			const result = await dependencies.authService.changePassword({
				staffId: authContext.staffId,
				currentSessionId: authContext.sessionId,
				currentPassword: body.currentPassword,
				newPassword: body.newPassword,
				primaryFactor: authContext.primaryFactor,
				mfaMethods: authContext.mfa,
				...getRequestMetadata(request)
			});
			dependencies.authCookies.applyAuthResult(response, result);
			await recordAuditLog(dependencies, request, response, {
				message: 'Staff changed their password.',
				actorStaffId: authContext.staffId,
				statusCode: 200,
				entityType: 'staff_password',
				entityId: authContext.staffId
			});
			response.status(200).json(getPublicAuthResult(result));
		},

		verifySecurityPassword: async (request, response) => {
			const body = getValidatedBody<SecurityReauthPasswordBody>(request);
			const authContext = requireAuthContext(response);
			const token = await dependencies.authService.verifySecurityPassword({
				staffId: authContext.staffId,
				sessionId: authContext.sessionId,
				action: body.action,
				targetId: body.targetId,
				password: body.password
			});
			dependencies.authCookies.setSecurityReauthToken(response, token);
			response.status(204).send();
		},

		verifySecurityTotp: async (request, response) => {
			const body = getValidatedBody<SecurityReauthTotpBody>(request);
			const authContext = requireAuthContext(response);
			const token = await dependencies.authService.verifySecurityTotp({
				staffId: authContext.staffId,
				sessionId: authContext.sessionId,
				action: body.action,
				targetId: body.targetId,
				code: body.code
			});
			dependencies.authCookies.setSecurityReauthToken(response, token);
			response.status(204).send();
		},

		beginSecurityPasskeyReauth: async (request, response) => {
			const body = getValidatedBody<SecurityReauthOptionsBody>(request);
			const authContext = requireAuthContext(response);
			const result = await dependencies.authService.beginSecurityPasskeyReauth({
				staffId: authContext.staffId,
				sessionId: authContext.sessionId,
				action: body.action,
				targetId: body.targetId
			});
			dependencies.authCookies.setCeremonyToken(response, result.ceremonyToken);
			response.status(200).json(getPublicPasskeyOptions(result));
		},

		verifySecurityPasskeyReauth: async (request, response) => {
			const body = getValidatedBody<SecurityPasskeyBody>(request);
			const authContext = requireAuthContext(response);
			const token = await dependencies.authService.verifySecurityPasskeyReauth({
				staffId: authContext.staffId,
				sessionId: authContext.sessionId,
				ceremonyToken: requireFlowToken(dependencies.authCookies.readCeremonyToken(request)),
				credential: body.credential
			});
			dependencies.authCookies.clearCeremonyToken(response);
			dependencies.authCookies.setSecurityReauthToken(response, token);
			response.status(204).send();
		},

		listPasskeys: async (_request, response) => {
			const authContext = requireAuthContext(response);
			response
				.status(200)
				.json({ data: await dependencies.authService.listPasskeys(authContext.staffId) });
		},

		renamePasskey: async (request, response) => {
			const params = getValidatedParams<PasskeyParams>(request);
			const body = getValidatedBody<{ nickname: string }>(request);
			const authContext = requireAuthContext(response);
			await requireSecurityReauthToken(
				dependencies,
				request,
				response,
				'rename_passkey',
				params.passkeyId
			);
			const result = await dependencies.authService.renamePasskey(
				authContext.staffId,
				params.passkeyId,
				body.nickname.trim()
			);
			dependencies.authCookies.clearSecurityReauthToken(response);
			await recordAuditLog(dependencies, request, response, {
				message: 'Staff renamed a passkey.',
				actorStaffId: authContext.staffId,
				statusCode: 200,
				entityType: 'passkey_credential',
				entityId: params.passkeyId
			});
			response.status(200).json(result);
		},

		removePasskey: async (request, response) => {
			const params = getValidatedParams<PasskeyParams>(request);
			const authContext = requireAuthContext(response);
			await requireSecurityReauthToken(
				dependencies,
				request,
				response,
				'remove_passkey',
				params.passkeyId
			);
			const result = await dependencies.authService.removePasskey(
				authContext.staffId,
				params.passkeyId
			);
			if (result.sessionsRevoked) dependencies.authCookies.clearSession(response);
			else dependencies.authCookies.clearSecurityReauthToken(response);
			await recordAuditLog(dependencies, request, response, {
				message: 'Staff removed a passkey.',
				actorStaffId: authContext.staffId,
				statusCode: 204,
				entityType: 'passkey_credential',
				entityId: params.passkeyId
			});
			response.status(204).send();
		}
	};

	return controller;
}
