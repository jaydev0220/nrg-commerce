import type { RequestHandler } from 'express';
import type { PermissionKey, RoleKey } from '@packages/database';

import { AppError } from '../errors/app-error.js';
import { requireAuthContext } from './authenticate.js';

export function requirePermission(permission: PermissionKey): RequestHandler {
	return (_request, response, next) => {
		try {
			const authContext = requireAuthContext(response);

			if (!authContext.permissions.includes(permission)) {
				throw new AppError(
					403,
					'FORBIDDEN',
					'The authenticated staff account does not have permission to perform this action.'
				);
			}

			next();
		} catch (error) {
			next(error);
		}
	};
}

export function requireRole(role: RoleKey): RequestHandler {
	return (_request, response, next) => {
		try {
			const authContext = requireAuthContext(response);

			if (!authContext.roles.includes(role)) {
				throw new AppError(
					403,
					'FORBIDDEN',
					'The authenticated staff account does not have permission to perform this action.'
				);
			}

			next();
		} catch (error) {
			next(error);
		}
	};
}

export function requireVerifiedMfa(): RequestHandler {
	return (_request, response, next) => {
		try {
			const authContext = requireAuthContext(response);

			if (authContext.mfa.length === 0) {
				throw new AppError(
					403,
					'MFA_SETUP_REQUIRED',
					'Complete MFA enrollment before accessing management APIs.'
				);
			}

			next();
		} catch (error) {
			next(error);
		}
	};
}
