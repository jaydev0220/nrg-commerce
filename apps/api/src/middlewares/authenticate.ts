import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppError } from '../errors/app-error.js';
import type { AuthService } from '../modules/auth/auth.service.js';
import type { AuthenticatedStaffContext } from '../types/auth.js';
import { authCookieNames } from '../utils/auth-cookies.js';
import { readCookie } from '../utils/http-cookies.js';

export const accessTokenCookieName = authCookieNames.access;

type AuthLocals = {
	auth?: AuthenticatedStaffContext;
};

function readAccessToken(request: Request, cookieName: string): string {
	const accessToken = readCookie(request, cookieName);

	if (!accessToken) {
		throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
	}

	return accessToken;
}

export function createAuthenticateMiddleware(
	authService: Pick<AuthService, 'authenticateAccessToken'>,
	cookieName: string = accessTokenCookieName
): RequestHandler {
	return async (request, response, next) => {
		try {
			const accessToken = readAccessToken(request, cookieName);
			const authContext = await authService.authenticateAccessToken(accessToken);
			(response.locals as AuthLocals).auth = authContext;
			next();
		} catch (error) {
			next(error);
		}
	};
}

export function requireAuthContext(response: Response): AuthenticatedStaffContext {
	const authContext = (response.locals as AuthLocals).auth;

	if (!authContext) {
		throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
	}

	return authContext;
}

export function getOptionalAuthContext(response: Response): AuthenticatedStaffContext | null {
	return (response.locals as AuthLocals).auth ?? null;
}

export function withAuthContext<T>(
	response: Response,
	run: (authContext: AuthenticatedStaffContext) => T
): T {
	return run(requireAuthContext(response));
}

export async function nextWithError(
	next: NextFunction,
	callback: () => Promise<void>
): Promise<void> {
	try {
		await callback();
	} catch (error) {
		next(error);
	}
}
