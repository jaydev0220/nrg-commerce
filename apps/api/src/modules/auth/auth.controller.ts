import type { Request, RequestHandler } from 'express';

import { requireAuthContext } from '../../middlewares/authenticate.js';
import { getRequestContext, getRequestPath } from '../../middlewares/request-context.js';
import { getValidatedBody, getValidatedParams } from '../../middlewares/validate-request.js';
import type { LogService } from '../management/log/log.service.js';
import type { AuthService } from './auth.service.js';

type AuthControllerDependencies = {
	authService: AuthService;
	logService: Pick<LogService, 'recordAuditLog'>;
};

type PasswordLoginBody = Omit<
	Parameters<AuthService['loginWithPassword']>[0],
	'userAgent' | 'ipAddress'
>;
type PasskeyLoginBody = Omit<
	Parameters<AuthService['verifyPasskeyLogin']>[0],
	'userAgent' | 'ipAddress'
>;
type TotpLoginBody = Omit<
	Parameters<AuthService['completeTotpLogin']>[0],
	'userAgent' | 'ipAddress'
>;
type PasskeyMfaBody = Omit<
	Parameters<AuthService['verifyPasskeyMfa']>[0],
	'userAgent' | 'ipAddress'
>;
type SessionParams = {
	sessionId: string;
};
type MfaPreferenceBody = Parameters<AuthService['updateMfaPreference']>[1];
type TotpSetupConfirmationBody = {
	setupToken: string;
	code: string;
};
type SetupTokenBody = {
	setupToken: string;
};
type SetupPasskeyStartBody = SetupTokenBody & {
	nickname?: string;
};
type PasskeyRegistrationStartBody = {
	nickname?: string;
};
type PasskeyRegistrationBody = Parameters<AuthService['finishPasskeyRegistration']>[1];
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
	getCurrentStaff: RequestHandler;
	listSessions: RequestHandler;
	revokeSession: RequestHandler;
	updateMfaPreference: RequestHandler;
	beginTotpSetup: RequestHandler;
	confirmTotpSetup: RequestHandler;
	removeTotp: RequestHandler;
	beginPasskeyRegistration: RequestHandler;
	finishPasskeyRegistration: RequestHandler;
};

function getRequestMetadata(request: Request) {
	return {
		userAgent: request.get('user-agent') ?? null,
		ipAddress: request.ip ?? null
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
			const statusCode = result.status === 'authenticated' ? 200 : 202;

			if (result.status === 'authenticated') {
				const requestContext = getRequestContext(request, response);
				await dependencies.logService.recordAuditLog({
					message: 'Staff logged in with password.',
					actorStaffId: result.staff.id,
					requestId: requestContext.requestId,
					method: request.method,
					path: getRequestPath(request),
					statusCode,
					entityType: 'auth_session',
					entityId: result.session.id,
					metadata: { primaryFactor: 'password' }
				});
			} else if (result.status === 'mfa_setup_required') {
				const requestContext = getRequestContext(request, response);
				await dependencies.logService.recordAuditLog({
					message: 'Staff authenticated with password and must complete MFA setup.',
					actorStaffId: result.staffId,
					requestId: requestContext.requestId,
					method: request.method,
					path: getRequestPath(request),
					statusCode,
					entityType: 'staff',
					entityId: result.staffId,
					metadata: { primaryFactor: 'password' }
				});
			}

			response.status(statusCode).json(result);
		},

		beginPasskeyLogin: async (request, response) => {
			const body = getValidatedBody<{ email: string }>(request);
			const result = await dependencies.authService.beginPasskeyLogin(body.email);
			response.status(200).json(result);
		},

		verifyPasskeyLogin: async (request, response) => {
			const body = getValidatedBody<PasskeyLoginBody>(request);
			const result = await dependencies.authService.verifyPasskeyLogin({
				ceremonyToken: body.ceremonyToken,
				credential: body.credential,
				...getRequestMetadata(request)
			});
			const statusCode = result.status === 'authenticated' ? 200 : 202;

			if (result.status === 'authenticated') {
				const requestContext = getRequestContext(request, response);
				await dependencies.logService.recordAuditLog({
					message: 'Staff logged in with passkey.',
					actorStaffId: result.staff.id,
					requestId: requestContext.requestId,
					method: request.method,
					path: getRequestPath(request),
					statusCode,
					entityType: 'auth_session',
					entityId: result.session.id,
					metadata: { primaryFactor: 'passkey' }
				});
			} else if (result.status === 'mfa_setup_required') {
				const requestContext = getRequestContext(request, response);
				await dependencies.logService.recordAuditLog({
					message: 'Staff authenticated with passkey and must complete MFA setup.',
					actorStaffId: result.staffId,
					requestId: requestContext.requestId,
					method: request.method,
					path: getRequestPath(request),
					statusCode,
					entityType: 'staff',
					entityId: result.staffId,
					metadata: { primaryFactor: 'passkey' }
				});
			}

			response.status(statusCode).json(result);
		},

		completeTotpLogin: async (request, response) => {
			const body = getValidatedBody<TotpLoginBody>(request);
			const result = await dependencies.authService.completeTotpLogin({
				pendingToken: body.pendingToken,
				code: body.code,
				...getRequestMetadata(request)
			});
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff completed TOTP login.',
				actorStaffId: result.staff.id,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'auth_session',
				entityId: result.session.id,
				metadata: { mfa: 'authenticator' }
			});

			response.status(200).json(result);
		},

		beginPasskeyMfa: async (request, response) => {
			const body = getValidatedBody<{ pendingToken: string }>(request);
			const result = await dependencies.authService.beginPasskeyMfa(body.pendingToken);
			response.status(200).json(result);
		},

		verifyPasskeyMfa: async (request, response) => {
			const body = getValidatedBody<PasskeyMfaBody>(request);
			const result = await dependencies.authService.verifyPasskeyMfa({
				ceremonyToken: body.ceremonyToken,
				credential: body.credential,
				...getRequestMetadata(request)
			});
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff completed passkey MFA login.',
				actorStaffId: result.staff.id,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'auth_session',
				entityId: result.session.id,
				metadata: { mfa: 'passkey' }
			});

			response.status(200).json(result);
		},

		beginLoginTotpSetup: async (request, response) => {
			const body = getValidatedBody<SetupTokenBody>(request);
			const result = await dependencies.authService.beginLoginTotpSetup(body.setupToken);
			response.status(200).json(result);
		},

		confirmLoginTotpSetup: async (request, response) => {
			const body = getValidatedBody<TotpSetupConfirmationBody>(request);
			const result = await dependencies.authService.confirmLoginTotpSetup({
				setupToken: body.setupToken,
				code: body.code,
				...getRequestMetadata(request)
			});
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff completed initial TOTP setup.',
				actorStaffId: result.staff.id,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'totp_credential',
				entityId: result.staff.id,
				metadata: { mfa: 'authenticator', source: 'login_setup' }
			});

			response.status(200).json(result);
		},

		beginLoginPasskeySetup: async (request, response) => {
			const body = getValidatedBody<SetupPasskeyStartBody>(request);
			const result = await dependencies.authService.beginLoginPasskeySetup(
				body.setupToken,
				body.nickname ?? null
			);
			response.status(200).json(result);
		},

		finishLoginPasskeySetup: async (request, response) => {
			const body = getValidatedBody<PasskeyRegistrationBody>(request);
			const result = await dependencies.authService.finishLoginPasskeySetup({
				ceremonyToken: body.ceremonyToken,
				credential: body.credential,
				...getRequestMetadata(request)
			});
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff completed initial passkey setup.',
				actorStaffId: result.staff.id,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'passkey_credential',
				entityId: result.staff.id,
				metadata: { mfa: 'passkey', source: 'login_setup' }
			});

			response.status(200).json(result);
		},

		refreshSession: async (request, response) => {
			const body = getValidatedBody<{ refreshToken: string }>(request);
			const result = await dependencies.authService.refreshSession(
				body.refreshToken,
				request.get('user-agent') ?? null,
				request.ip ?? null
			);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff refreshed an auth session.',
				actorStaffId: result.staff.id,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'auth_session',
				entityId: result.session.id
			});

			response.status(200).json(result);
		},

		logout: async (request, response) => {
			const authContext = requireAuthContext(response);
			await dependencies.authService.logout(authContext.sessionId);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff logged out.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 204,
				entityType: 'auth_session',
				entityId: authContext.sessionId
			});
			response.status(204).send();
		},

		getCurrentStaff: async (_request, response) => {
			const authContext = requireAuthContext(response);
			response.status(200).json({
				staff: authContext.staff,
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
			await dependencies.authService.revokeSession(
				requireAuthContext(response).staffId,
				params.sessionId
			);
			const authContext = requireAuthContext(response);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff revoked an auth session.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 204,
				entityType: 'auth_session',
				entityId: params.sessionId
			});
			response.status(204).send();
		},

		updateMfaPreference: async (request, response) => {
			const authContext = requireAuthContext(response);
			const body = getValidatedBody<MfaPreferenceBody>(request);
			await dependencies.authService.updateMfaPreference(authContext.staffId, {
				mfaRequired: body.mfaRequired,
				preferredMfaMethod: body.preferredMfaMethod ?? null
			});
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff updated MFA preference.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 204,
				entityType: 'mfa_preference',
				entityId: authContext.staffId,
				metadata: {
					mfaRequired: body.mfaRequired,
					preferredMfaMethod: body.preferredMfaMethod ?? null
				}
			});
			response.status(204).send();
		},

		beginTotpSetup: async (_request, response) => {
			const authContext = requireAuthContext(response);
			const result = await dependencies.authService.beginTotpSetup(
				authContext.staffId,
				authContext.staff.email
			);
			response.status(200).json(result);
		},

		confirmTotpSetup: async (request, response) => {
			const body = getValidatedBody<TotpSetupConfirmationBody>(request);
			const authContext = requireAuthContext(response);
			await dependencies.authService.confirmTotpSetup(
				authContext.staffId,
				body.setupToken,
				body.code
			);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff confirmed TOTP setup.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 204,
				entityType: 'totp_credential',
				entityId: authContext.staffId
			});
			response.status(204).send();
		},

		removeTotp: async (request, response) => {
			const authContext = requireAuthContext(response);
			await dependencies.authService.removeTotp(authContext.staffId);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff removed TOTP.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 204,
				entityType: 'totp_credential',
				entityId: authContext.staffId
			});
			response.status(204).send();
		},

		beginPasskeyRegistration: async (request, response) => {
			const authContext = requireAuthContext(response);
			const body = getValidatedBody<PasskeyRegistrationStartBody>(request);
			const result = await dependencies.authService.beginPasskeyRegistration(
				authContext.staff,
				body.nickname ?? null
			);
			response.status(200).json(result);
		},

		finishPasskeyRegistration: async (request, response) => {
			const body = getValidatedBody<PasskeyRegistrationBody>(request);
			const result = await dependencies.authService.finishPasskeyRegistration(
				requireAuthContext(response).staffId,
				{
					ceremonyToken: body.ceremonyToken,
					credential: body.credential
				}
			);
			const authContext = requireAuthContext(response);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff registered a passkey.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 201,
				entityType: 'passkey_credential',
				entityId: result.id
			});

			response.status(201).json(result);
		}
	};

	return controller;
}
