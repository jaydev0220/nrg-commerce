import type { CookieOptions, Request, Response } from 'express';

import type {
	AuthMfaChallengeResult,
	AuthMfaSetupRequiredResult,
	AuthSuccessResult,
	PasskeyOptionsResult,
	TOTPSetupResult
} from '../types/auth.js';
import { readCookie } from './http-cookies.js';

export const authCookieNames = {
	access: 'admin_access_token',
	refresh: 'admin_refresh_token',
	pending: 'admin_mfa_pending_token',
	setup: 'admin_mfa_setup_token',
	ceremony: 'admin_passkey_ceremony_token',
	securityReauth: 'admin_security_reauth_token'
} as const;

type AuthResult = AuthSuccessResult | AuthMfaChallengeResult | AuthMfaSetupRequiredResult;

type AuthCookieOptions = {
	secure: boolean;
	sameSite: 'lax' | 'strict' | 'none';
	accessMaxAgeSeconds: number;
	refreshMaxAgeSeconds: number;
	flowMaxAgeSeconds: number;
};

function baseCookieOptions(options: AuthCookieOptions): CookieOptions {
	return {
		httpOnly: true,
		secure: options.secure,
		sameSite: options.sameSite,
		path: '/'
	};
}

export function getPublicAuthResult(result: AuthResult) {
	if (result.status === 'authenticated') return { status: result.status };
	if (result.status === 'mfa_required') {
		return {
			status: result.status,
			method: result.method,
			availableMethods: result.availableMethods
		};
	}
	return { status: result.status, availableMethods: result.availableMethods };
}

export function getPublicPasskeyOptions(result: PasskeyOptionsResult) {
	return { options: result.options };
}

export function getPublicTotpSetup(result: TOTPSetupResult) {
	return {
		secret: result.secret,
		otpauthUrl: result.otpauthUrl,
		digits: result.digits,
		period: result.period
	};
}

export function createAuthCookieManager(options: AuthCookieOptions) {
	const baseOptions = baseCookieOptions(options);
	const accessOptions = { ...baseOptions, maxAge: options.accessMaxAgeSeconds * 1_000 };
	const refreshOptions = { ...baseOptions, maxAge: options.refreshMaxAgeSeconds * 1_000 };
	const flowOptions = { ...baseOptions, maxAge: options.flowMaxAgeSeconds * 1_000 };

	function clearCookie(response: Response, name: string): void {
		response.clearCookie(name, baseOptions);
	}

	function clearAuthFlowCookies(response: Response): void {
		clearCookie(response, authCookieNames.pending);
		clearCookie(response, authCookieNames.setup);
		clearCookie(response, authCookieNames.ceremony);
		clearCookie(response, authCookieNames.securityReauth);
	}

	return {
		applyAuthResult(response: Response, result: AuthResult): void {
			clearAuthFlowCookies(response);
			if (result.status === 'authenticated') {
				response.cookie(authCookieNames.access, result.accessToken, accessOptions);
				response.cookie(authCookieNames.refresh, result.refreshToken, refreshOptions);
				return;
			}
			clearCookie(response, authCookieNames.access);
			clearCookie(response, authCookieNames.refresh);
			if (result.status === 'mfa_required') {
				response.cookie(authCookieNames.pending, result.pendingToken, flowOptions);
				return;
			}
			response.cookie(authCookieNames.setup, result.setupToken, flowOptions);
		},

		setCeremonyToken(response: Response, ceremonyToken: string): void {
			response.cookie(authCookieNames.ceremony, ceremonyToken, flowOptions);
		},

		setSetupToken(response: Response, setupToken: string): void {
			response.cookie(authCookieNames.setup, setupToken, flowOptions);
		},

		setSecurityReauthToken(response: Response, token: string): void {
			response.cookie(authCookieNames.securityReauth, token, flowOptions);
		},

		clearCeremonyToken(response: Response): void {
			clearCookie(response, authCookieNames.ceremony);
		},

		clearSetupToken(response: Response): void {
			clearCookie(response, authCookieNames.setup);
		},

		clearSecurityReauthToken(response: Response): void {
			clearCookie(response, authCookieNames.securityReauth);
		},

		clearSession(response: Response): void {
			clearCookie(response, authCookieNames.access);
			clearCookie(response, authCookieNames.refresh);
			clearAuthFlowCookies(response);
		},

		readAccessToken(request: Request): string | null {
			return readCookie(request, authCookieNames.access);
		},

		readRefreshToken(request: Request): string | null {
			return readCookie(request, authCookieNames.refresh);
		},

		readPendingToken(request: Request): string | null {
			return readCookie(request, authCookieNames.pending);
		},

		readSetupToken(request: Request): string | null {
			return readCookie(request, authCookieNames.setup);
		},

		readCeremonyToken(request: Request): string | null {
			return readCookie(request, authCookieNames.ceremony);
		},

		readSecurityReauthToken(request: Request): string | null {
			return readCookie(request, authCookieNames.securityReauth);
		},

		readFlowState(request: Request, includeAccess = true) {
			if (includeAccess && readCookie(request, authCookieNames.access)) {
				return { status: 'authenticated' as const };
			}
			if (readCookie(request, authCookieNames.setup)) {
				return {
					status: 'mfa_setup_required' as const,
					availableMethods: ['authenticator', 'passkey'] as const
				};
			}
			if (readCookie(request, authCookieNames.refresh)) {
				return { status: 'refresh_required' as const };
			}
			return { status: 'unauthenticated' as const };
		}
	};
}

export type AuthCookieManager = ReturnType<typeof createAuthCookieManager>;
