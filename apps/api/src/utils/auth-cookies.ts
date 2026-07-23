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

export const secureAuthCookieNames = {
	access: '__Host-admin_access_token',
	refresh: '__Host-admin_refresh_token',
	pending: '__Host-admin_mfa_pending_token',
	setup: '__Host-admin_mfa_setup_token',
	ceremony: '__Host-admin_passkey_ceremony_token',
	securityReauth: '__Host-admin_security_reauth_token'
} as const;

export function resolveAuthCookieNames(secure: boolean) {
	return secure ? secureAuthCookieNames : authCookieNames;
}

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
	const cookieNames = resolveAuthCookieNames(options.secure);
	const baseOptions = baseCookieOptions(options);
	const accessOptions = { ...baseOptions, maxAge: options.accessMaxAgeSeconds * 1_000 };
	const refreshOptions = { ...baseOptions, maxAge: options.refreshMaxAgeSeconds * 1_000 };
	const flowOptions = { ...baseOptions, maxAge: options.flowMaxAgeSeconds * 1_000 };

	function clearCookie(response: Response, name: string): void {
		response.clearCookie(name, baseOptions);
	}

	function clearAuthFlowCookies(response: Response): void {
		clearCookie(response, cookieNames.pending);
		clearCookie(response, cookieNames.setup);
		clearCookie(response, cookieNames.ceremony);
		clearCookie(response, cookieNames.securityReauth);
	}

	return {
		applyAuthResult(response: Response, result: AuthResult): void {
			clearAuthFlowCookies(response);
			if (result.status === 'authenticated') {
				response.cookie(cookieNames.access, result.accessToken, accessOptions);
				response.cookie(cookieNames.refresh, result.refreshToken, refreshOptions);
				return;
			}
			clearCookie(response, cookieNames.access);
			clearCookie(response, cookieNames.refresh);
			if (result.status === 'mfa_required') {
				response.cookie(cookieNames.pending, result.pendingToken, flowOptions);
				return;
			}
			response.cookie(cookieNames.setup, result.setupToken, flowOptions);
		},

		setCeremonyToken(response: Response, ceremonyToken: string): void {
			response.cookie(cookieNames.ceremony, ceremonyToken, flowOptions);
		},

		setSetupToken(response: Response, setupToken: string): void {
			response.cookie(cookieNames.setup, setupToken, flowOptions);
		},

		setSecurityReauthToken(response: Response, token: string): void {
			response.cookie(cookieNames.securityReauth, token, flowOptions);
		},

		clearCeremonyToken(response: Response): void {
			clearCookie(response, cookieNames.ceremony);
		},

		clearSetupToken(response: Response): void {
			clearCookie(response, cookieNames.setup);
		},

		clearSecurityReauthToken(response: Response): void {
			clearCookie(response, cookieNames.securityReauth);
		},

		clearSession(response: Response): void {
			clearCookie(response, cookieNames.access);
			clearCookie(response, cookieNames.refresh);
			clearAuthFlowCookies(response);
		},

		readAccessToken(request: Request): string | null {
			return readCookie(request, cookieNames.access);
		},

		readRefreshToken(request: Request): string | null {
			return readCookie(request, cookieNames.refresh);
		},

		readPendingToken(request: Request): string | null {
			return readCookie(request, cookieNames.pending);
		},

		readSetupToken(request: Request): string | null {
			return readCookie(request, cookieNames.setup);
		},

		readCeremonyToken(request: Request): string | null {
			return readCookie(request, cookieNames.ceremony);
		},

		readSecurityReauthToken(request: Request): string | null {
			return readCookie(request, cookieNames.securityReauth);
		},

		readFlowState(request: Request, includeAccess = true) {
			if (includeAccess && readCookie(request, cookieNames.access)) {
				return { status: 'authenticated' as const };
			}
			if (readCookie(request, cookieNames.setup)) {
				return {
					status: 'mfa_setup_required' as const,
					availableMethods: ['authenticator', 'passkey'] as const
				};
			}
			if (readCookie(request, cookieNames.refresh)) {
				return { status: 'refresh_required' as const };
			}
			return { status: 'unauthenticated' as const };
		}
	};
}

export type AuthCookieManager = ReturnType<typeof createAuthCookieManager>;
