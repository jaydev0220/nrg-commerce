import type { Request, RequestHandler } from 'express';

import { requireAuthContext } from '../../middlewares/authenticate.js';
import { getValidatedBody, getValidatedParams } from '../../middlewares/validate-request.js';
import type { AuthService } from './auth.service.js';

type AuthControllerDependencies = {
	authService: AuthService;
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

			response.status(result.status === 'authenticated' ? 200 : 202).json(result);
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

			response.status(result.status === 'authenticated' ? 200 : 202).json(result);
		},

		completeTotpLogin: async (request, response) => {
			const body = getValidatedBody<TotpLoginBody>(request);
			const result = await dependencies.authService.completeTotpLogin({
				pendingToken: body.pendingToken,
				code: body.code,
				...getRequestMetadata(request)
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

			response.status(200).json(result);
		},

		refreshSession: async (request, response) => {
			const body = getValidatedBody<{ refreshToken: string }>(request);
			const result = await dependencies.authService.refreshSession(
				body.refreshToken,
				request.get('user-agent') ?? null,
				request.ip ?? null
			);

			response.status(200).json(result);
		},

		logout: async (_request, response) => {
			await dependencies.authService.logout(requireAuthContext(response).sessionId);
			response.status(204).send();
		},

		getCurrentStaff: async (_request, response) => {
			const authContext = requireAuthContext(response);
			response.status(200).json({
				staff: authContext.staff,
				sessionId: authContext.sessionId
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
			response.status(204).send();
		},

		updateMfaPreference: async (request, response) => {
			const body = getValidatedBody<MfaPreferenceBody>(request);
			await dependencies.authService.updateMfaPreference(requireAuthContext(response).staffId, {
				mfaRequired: body.mfaRequired,
				preferredMfaMethod: body.preferredMfaMethod ?? null
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
			await dependencies.authService.confirmTotpSetup(
				requireAuthContext(response).staffId,
				body.setupToken,
				body.code
			);
			response.status(204).send();
		},

		removeTotp: async (_request, response) => {
			await dependencies.authService.removeTotp(requireAuthContext(response).staffId);
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

			response.status(201).json(result);
		}
	};

	return controller;
}
