import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
	authFlowStateResponseSchema,
	authResultResponseSchema,
	currentStaffEnvelopeResponseSchema,
	dataResponseSchema,
	managedAuthSessionResponseSchema,
	managedPasskeyResponseSchema,
	mfaPreferenceSchema,
	passkeyAuthenticationStartSchema,
	passkeyAuthenticationVerificationSchema,
	passkeyManagementRegistrationStartSchema,
	passkeyNicknameUpdateSchema,
	passkeyOptionsResponseSchema,
	passkeyRegistrationStartSchema,
	passwordChangeSchema,
	passwordLoginSchema,
	refreshTokenRequestSchema,
	revokedCountResponseSchema,
	securityReauthOptionsSchema,
	securityReauthPasswordSchema,
	securityReauthTotpSchema,
	totpChallengeSchema,
	totpSetupConfirmationSchema,
	totpSetupResponseSchema
} from '@packages/schemas';
import { notFound } from '../http/errors.js';
import { parseBody, sendJson } from '../http/validation.js';
import type { MockState } from '../state.js';

const csrfToken = 'mock-csrf-token';
const passkeyOptions = { options: { challenge: 'mock-passkey-challenge' } };
const totpSetup = {
	secret: 'JBSWY3DPEHPK3PXP',
	totpauthUrl: 'otpauth://totp/NRG:admin@nrg.local?secret=JBSWY3DPEHPK3PXP&issuer=NRG',
	digits: 6,
	period: 30
};

function currentStaff(state: MockState) {
	return (
		state.staff.find((staff) => staff.id === state.currentStaffId) ??
		notFound('Mock administrator is missing.')
	);
}

function noContent(response: import('express').Response): void {
	response.status(204).end();
}

export function createAuthRouter(state: MockState): Router {
	const router = Router();

	router.get('/csrf', (_request, response) => response.json({ csrfToken }));
	router.get('/state', (_request, response) => {
		sendJson(response, authFlowStateResponseSchema, { status: 'authenticated' });
	});
	router.post('/refresh', (request, response) => {
		parseBody(request, refreshTokenRequestSchema);
		noContent(response);
	});
	router.get('/me', (_request, response) => {
		const staff = currentStaff(state);
		sendJson(response, currentStaffEnvelopeResponseSchema, {
			staff: {
				id: staff.id,
				email: staff.email,
				name: staff.name,
				status: staff.status,
				preferredMfaMethod: staff.preferredMfaMethod,
				lastLoginAt: staff.lastLoginAt,
				roles: staff.roles,
				totpCredentialCount: 1,
				passkeyCredentialCount: state.passkeys.length
			},
			sessionId: state.currentSessionId,
			mfaMethods: ['authenticator', 'passkey']
		});
	});

	router.get('/sessions', (_request, response) => {
		sendJson(response, dataResponseSchema(managedAuthSessionResponseSchema), {
			data: state.authSessions
		});
	});
	router.delete('/sessions/:sessionId', (request, response) => {
		const session = state.authSessions.find((entry) => entry.id === request.params['sessionId']);
		if (!session) notFound();
		session.revokedAt = new Date();
		noContent(response);
	});
	router.post('/sessions/revoke-others', (request, response) => {
		parseBody(request, refreshTokenRequestSchema);
		let revokedCount = 0;
		for (const session of state.authSessions) {
			if (session.id === state.currentSessionId || session.revokedAt) continue;
			session.revokedAt = new Date();
			revokedCount += 1;
		}
		sendJson(response, revokedCountResponseSchema, { revokedCount });
	});

	router.get('/passkeys', (_request, response) => {
		sendJson(response, dataResponseSchema(managedPasskeyResponseSchema), { data: state.passkeys });
	});
	router.post('/passkeys/registration/options', (request, response) => {
		parseBody(request, passkeyManagementRegistrationStartSchema);
		sendJson(response, passkeyOptionsResponseSchema, passkeyOptions);
	});
	router.post('/passkeys/registration/verify', (request, response) => {
		parseBody(request, passkeyAuthenticationVerificationSchema);
		const passkey = {
			id: randomUUID(),
			nickname: 'Mock Passkey',
			deviceType: 'multiDevice' as const,
			backedUp: true,
			verifiedAt: new Date(),
			lastUsedAt: null
		};
		state.passkeys.push(passkey);
		sendJson(response, managedPasskeyResponseSchema, passkey, 201);
	});
	router.patch('/passkeys/:passkeyId', (request, response) => {
		const input = parseBody(request, passkeyNicknameUpdateSchema);
		const passkey = state.passkeys.find((entry) => entry.id === request.params['passkeyId']);
		if (!passkey) notFound();
		passkey.nickname = input.nickname;
		sendJson(response, managedPasskeyResponseSchema, passkey);
	});
	router.delete('/passkeys/:passkeyId', (request, response) => {
		const index = state.passkeys.findIndex((entry) => entry.id === request.params['passkeyId']);
		if (index < 0) notFound();
		state.passkeys.splice(index, 1);
		noContent(response);
	});

	router.patch('/password', (request, response) => {
		parseBody(request, passwordChangeSchema);
		sendJson(response, authResultResponseSchema, { status: 'authenticated' });
	});
	router.patch('/mfa-preference', (request, response) => {
		const input = parseBody(request, mfaPreferenceSchema);
		currentStaff(state).preferredMfaMethod = input.preferredMfaMethod;
		noContent(response);
	});
	router.post('/security/reauth/password', (request, response) => {
		parseBody(request, securityReauthPasswordSchema);
		noContent(response);
	});
	router.post('/security/reauth/totp', (request, response) => {
		parseBody(request, securityReauthTotpSchema);
		noContent(response);
	});
	router.post('/security/reauth/passkey/options', (request, response) => {
		parseBody(request, securityReauthOptionsSchema);
		sendJson(response, passkeyOptionsResponseSchema, passkeyOptions);
	});
	router.post('/security/reauth/passkey/verify', (request, response) => {
		parseBody(request, passkeyAuthenticationVerificationSchema);
		noContent(response);
	});

	router.post('/mfa/totp/setup', (request, response) => {
		parseBody(request, refreshTokenRequestSchema);
		sendJson(response, totpSetupResponseSchema, totpSetup);
	});
	router.post('/mfa/totp/confirm', (request, response) => {
		parseBody(request, totpSetupConfirmationSchema);
		noContent(response);
	});
	router.delete('/mfa/totp', (_request, response) => noContent(response));

	router.post('/login/password', (request, response) => {
		parseBody(request, passwordLoginSchema);
		sendJson(response, authResultResponseSchema, { status: 'authenticated' });
	});
	router.post('/login/passkey/options', (request, response) => {
		parseBody(request, passkeyAuthenticationStartSchema);
		sendJson(response, passkeyOptionsResponseSchema, passkeyOptions);
	});
	router.post('/login/passkey/verify', (request, response) => {
		parseBody(request, passkeyAuthenticationVerificationSchema);
		sendJson(response, authResultResponseSchema, { status: 'authenticated' });
	});
	router.post('/login/mfa/totp', (request, response) => {
		parseBody(request, totpChallengeSchema);
		sendJson(response, authResultResponseSchema, { status: 'authenticated' });
	});
	router.post('/login/mfa/passkey/options', (request, response) => {
		parseBody(request, passkeyAuthenticationStartSchema);
		sendJson(response, passkeyOptionsResponseSchema, passkeyOptions);
	});
	router.post('/login/mfa/passkey/verify', (request, response) => {
		parseBody(request, passkeyAuthenticationVerificationSchema);
		sendJson(response, authResultResponseSchema, { status: 'authenticated' });
	});
	router.post('/login/setup/totp/options', (request, response) => {
		parseBody(request, refreshTokenRequestSchema);
		sendJson(response, totpSetupResponseSchema, totpSetup);
	});
	router.post('/login/setup/totp/confirm', (request, response) => {
		parseBody(request, totpSetupConfirmationSchema);
		sendJson(response, authResultResponseSchema, { status: 'authenticated' });
	});
	router.post('/login/setup/passkey/options', (request, response) => {
		parseBody(request, passkeyRegistrationStartSchema);
		sendJson(response, passkeyOptionsResponseSchema, passkeyOptions);
	});
	router.post('/login/setup/passkey/verify', (request, response) => {
		parseBody(request, passkeyAuthenticationVerificationSchema);
		sendJson(response, authResultResponseSchema, { status: 'authenticated' });
	});
	router.post('/logout', (request, response) => {
		parseBody(request, refreshTokenRequestSchema);
		noContent(response);
	});

	return router;
}

export function csrfHeaderIsValid(value: string | undefined): boolean {
	return value === csrfToken;
}
