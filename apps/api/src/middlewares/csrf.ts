import { randomBytes, timingSafeEqual } from 'node:crypto';

import type { CookieOptions, RequestHandler } from 'express';

import { AppError } from '../errors/app-error.js';
import { readCookie } from '../utils/http-cookies.js';

export const csrfCookieName = 'admin_csrf_token';
export const secureCsrfCookieName = '__Host-admin_csrf_token';

function resolveCsrfCookieName(secure: boolean): string {
	return secure ? secureCsrfCookieName : csrfCookieName;
}

type CsrfOptions = {
	allowedOrigins: string[];
	cookieSecure: boolean;
	cookieSameSite: 'lax' | 'strict' | 'none';
	cookieMaxAgeSeconds: number;
};

function createCookieOptions(options: CsrfOptions): CookieOptions {
	return {
		httpOnly: true,
		secure: options.cookieSecure,
		sameSite: options.cookieSameSite,
		path: '/',
		maxAge: options.cookieMaxAgeSeconds * 1_000
	};
}

function tokensMatch(left: string, right: string): boolean {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);
	return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyOrigin(origin: string | undefined, allowedOrigins: string[]): void {
	if (!origin || !allowedOrigins.includes(origin)) {
		throw new AppError(403, 'ORIGIN_NOT_ALLOWED', 'The request origin is not allowed.');
	}
}

export function createCsrfTokenHandler(options: CsrfOptions): RequestHandler {
	return (request, response) => {
		const cookieName = resolveCsrfCookieName(options.cookieSecure);
		const csrfToken = readCookie(request, cookieName) ?? randomBytes(32).toString('base64url');
		response.cookie(cookieName, csrfToken, createCookieOptions(options));
		response.status(200).json({ csrfToken });
	};
}

export function createCsrfProtectionMiddleware(options: CsrfOptions): RequestHandler {
	return (request, _response, next) => {
		if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
			next();
			return;
		}

		try {
			verifyOrigin(request.get('origin'), options.allowedOrigins);
			const cookieToken = readCookie(request, resolveCsrfCookieName(options.cookieSecure));
			const headerToken = request.get('x-csrf-token');
			if (!cookieToken || !headerToken || !tokensMatch(cookieToken, headerToken)) {
				throw new AppError(403, 'CSRF_VALIDATION_FAILED', 'The CSRF token is missing or invalid.');
			}
			next();
		} catch (error) {
			next(error);
		}
	};
}
