import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppError } from '../errors/app-error.js';
import type { AuthService } from '../modules/auth/auth.service.js';
import type { AuthenticatedStaffContext } from '../types/auth.js';

type AuthLocals = {
	auth?: AuthenticatedStaffContext;
};

function parseBearerToken(request: Request): string {
	const authorizationHeader = request.get('authorization');

	if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
		throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
	}

	return authorizationHeader.slice('Bearer '.length).trim();
}

export function createAuthenticateMiddleware(
	authService: Pick<AuthService, 'authenticateAccessToken'>
): RequestHandler {
	return async (request, response, next) => {
		try {
			const accessToken = parseBearerToken(request);
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
