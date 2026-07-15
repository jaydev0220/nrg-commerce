import { Router, type RequestHandler } from 'express';
import {
	z,
	mfaPreferenceSchema,
	passkeyAuthenticationStartSchema,
	passkeyAuthenticationVerificationSchema,
	passkeyManagementRegistrationStartSchema,
	passkeyNicknameUpdateSchema,
	passkeyRegistrationStartSchema,
	passwordChangeSchema,
	passwordLoginSchema,
	pendingAuthTokenSchema,
	refreshTokenRequestSchema,
	setupTokenRequestSchema,
	securityReauthOptionsSchema,
	securityReauthPasswordSchema,
	securityReauthTotpSchema,
	totpChallengeSchema,
	totpSetupConfirmationSchema,
	uuidSchema
} from '@packages/schemas';

import { validateRequest } from '../../middlewares/validate-request.js';
import type { AuthCookieManager } from '../../utils/auth-cookies.js';
import type { LogService } from '../management/log/log.service.js';
import { createAuthController } from './auth.controller.js';
import type { AuthService } from './auth.service.js';

type AuthRouterDependencies = {
	authService: AuthService;
	logService: Pick<LogService, 'recordAuditLog'>;
	authRateLimiter: ReturnType<typeof import('express-rate-limit').rateLimit>;
	authenticate: RequestHandler;
	authCookies: AuthCookieManager;
	csrfTokenHandler: RequestHandler;
};

const sessionParamsSchema = z.object({
	sessionId: uuidSchema
});

const passkeyParamsSchema = z.object({
	passkeyId: uuidSchema
});

const pendingTotpChallengeSchema = pendingAuthTokenSchema.extend({
	code: totpChallengeSchema.shape.code
});

const setupPasskeyStartSchema = setupTokenRequestSchema.extend({
	nickname: passkeyRegistrationStartSchema.shape.nickname
});

export function createAuthRouter(dependencies: AuthRouterDependencies): Router {
	const controller = createAuthController({
		authService: dependencies.authService,
		authCookies: dependencies.authCookies,
		logService: dependencies.logService
	});
	const router = Router();
	const protectedRouter = Router();

	protectedRouter.use(dependencies.authenticate);
	router.get('/csrf', dependencies.csrfTokenHandler);
	router.get('/state', controller.getAuthState);

	router.post(
		'/login/password',
		dependencies.authRateLimiter,
		validateRequest({ body: passwordLoginSchema }),
		controller.loginWithPassword
	);

	router.post(
		'/login/passkey/options',
		dependencies.authRateLimiter,
		validateRequest({ body: passkeyAuthenticationStartSchema }),
		controller.beginPasskeyLogin
	);

	router.post(
		'/login/passkey/verify',
		dependencies.authRateLimiter,
		validateRequest({ body: passkeyAuthenticationVerificationSchema }),
		controller.verifyPasskeyLogin
	);

	router.post(
		'/login/mfa/totp',
		dependencies.authRateLimiter,
		validateRequest({ body: pendingTotpChallengeSchema }),
		controller.completeTotpLogin
	);

	router.post(
		'/login/mfa/passkey/options',
		dependencies.authRateLimiter,
		validateRequest({ body: pendingAuthTokenSchema }),
		controller.beginPasskeyMfa
	);

	router.post(
		'/login/mfa/passkey/verify',
		dependencies.authRateLimiter,
		validateRequest({ body: passkeyAuthenticationVerificationSchema }),
		controller.verifyPasskeyMfa
	);

	router.post(
		'/login/setup/totp/options',
		dependencies.authRateLimiter,
		validateRequest({ body: setupTokenRequestSchema }),
		controller.beginLoginTotpSetup
	);

	router.post(
		'/login/setup/totp/confirm',
		dependencies.authRateLimiter,
		validateRequest({ body: totpSetupConfirmationSchema }),
		controller.confirmLoginTotpSetup
	);

	router.post(
		'/login/setup/passkey/options',
		dependencies.authRateLimiter,
		validateRequest({ body: setupPasskeyStartSchema }),
		controller.beginLoginPasskeySetup
	);

	router.post(
		'/login/setup/passkey/verify',
		dependencies.authRateLimiter,
		validateRequest({ body: passkeyAuthenticationVerificationSchema }),
		controller.finishLoginPasskeySetup
	);

	router.post(
		'/refresh',
		dependencies.authRateLimiter,
		validateRequest({ body: refreshTokenRequestSchema }),
		controller.refreshSession
	);

	router.post('/logout', controller.logout);

	protectedRouter.get('/me', controller.getCurrentStaff);

	protectedRouter.get('/sessions', controller.listSessions);

	protectedRouter.delete(
		'/sessions/:sessionId',
		validateRequest({ params: sessionParamsSchema }),
		controller.revokeSession
	);

	protectedRouter.post('/sessions/revoke-others', controller.revokeOtherSessions);

	protectedRouter.patch(
		'/password',
		validateRequest({ body: passwordChangeSchema }),
		controller.changePassword
	);

	protectedRouter.patch(
		'/mfa-preference',
		validateRequest({ body: mfaPreferenceSchema }),
		controller.updateMfaPreference
	);

	protectedRouter.post('/mfa/totp/setup', controller.beginTotpSetup);

	protectedRouter.post(
		'/mfa/totp/confirm',
		validateRequest({ body: totpSetupConfirmationSchema }),
		controller.confirmTotpSetup
	);

	protectedRouter.delete('/mfa/totp', controller.removeTotp);

	protectedRouter.post(
		'/security/reauth/password',
		validateRequest({ body: securityReauthPasswordSchema }),
		controller.verifySecurityPassword
	);

	protectedRouter.post(
		'/security/reauth/totp',
		validateRequest({ body: securityReauthTotpSchema }),
		controller.verifySecurityTotp
	);

	protectedRouter.post(
		'/security/reauth/passkey/options',
		validateRequest({ body: securityReauthOptionsSchema }),
		controller.beginSecurityPasskeyReauth
	);

	protectedRouter.post(
		'/security/reauth/passkey/verify',
		validateRequest({ body: passkeyAuthenticationVerificationSchema }),
		controller.verifySecurityPasskeyReauth
	);

	protectedRouter.get('/passkeys', controller.listPasskeys);

	protectedRouter.patch(
		'/passkeys/:passkeyId',
		validateRequest({ params: passkeyParamsSchema, body: passkeyNicknameUpdateSchema }),
		controller.renamePasskey
	);

	protectedRouter.delete(
		'/passkeys/:passkeyId',
		validateRequest({ params: passkeyParamsSchema }),
		controller.removePasskey
	);

	protectedRouter.post(
		'/passkeys/registration/options',
		validateRequest({ body: passkeyManagementRegistrationStartSchema }),
		controller.beginPasskeyRegistration
	);

	protectedRouter.post(
		'/passkeys/registration/verify',
		validateRequest({ body: passkeyAuthenticationVerificationSchema }),
		controller.finishPasskeyRegistration
	);

	router.use(protectedRouter);

	return router;
}
