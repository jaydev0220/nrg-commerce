import { Router, type RequestHandler } from 'express';
import {
	z,
	mfaPreferenceSchema,
	passkeyAuthenticationStartSchema,
	passkeyAuthenticationVerificationSchema,
	passkeyRegistrationStartSchema,
	passwordLoginSchema,
	pendingAuthTokenSchema,
	refreshTokenRequestSchema,
	totpChallengeSchema,
	totpSetupConfirmationSchema,
	uuidSchema
} from '@packages/schemas';

import { validateRequest } from '../../middlewares/validate-request.js';
import { createAuthController } from './auth.controller.js';
import type { AuthService } from './auth.service.js';

type AuthRouterDependencies = {
	authService: AuthService;
	authRateLimiter: ReturnType<typeof import('express-rate-limit').rateLimit>;
	authenticate: RequestHandler;
};

const sessionParamsSchema = z.object({
	sessionId: uuidSchema
});

const pendingTotpChallengeSchema = pendingAuthTokenSchema.extend({
	code: totpChallengeSchema.shape.code
});

export function createAuthRouter(dependencies: AuthRouterDependencies): Router {
	const controller = createAuthController({
		authService: dependencies.authService
	});
	const router = Router();
	const protectedRouter = Router();

	protectedRouter.use(dependencies.authenticate);

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
		'/refresh',
		dependencies.authRateLimiter,
		validateRequest({ body: refreshTokenRequestSchema }),
		controller.refreshSession
	);

	protectedRouter.post('/logout', controller.logout);

	protectedRouter.get('/me', controller.getCurrentStaff);

	protectedRouter.get('/sessions', controller.listSessions);

	protectedRouter.delete(
		'/sessions/:sessionId',
		validateRequest({ params: sessionParamsSchema }),
		controller.revokeSession
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
		'/passkeys/registration/options',
		validateRequest({ body: passkeyRegistrationStartSchema }),
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
