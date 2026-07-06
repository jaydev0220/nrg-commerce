import type { Request, RequestHandler } from 'express';
import type { ZodType } from '@packages/schemas';

type RequestSchemas = {
	body?: ZodType;
	params?: ZodType;
	query?: ZodType;
};

export function validateRequest(schemas: RequestSchemas): RequestHandler {
	return (request, _response, next) => {
		try {
			if (schemas.body) {
				request.body = schemas.body.parse(request.body) as Request['body'];
			}

			if (schemas.params) {
				request.params = schemas.params.parse(request.params) as Request['params'];
			}

			if (schemas.query) {
				Object.defineProperty(request, 'query', {
					configurable: true,
					value: schemas.query.parse(request.query) as Request['query']
				});
			}

			next();
		} catch (error) {
			next(error);
		}
	};
}

export function getValidatedBody<T>(request: Request): T {
	return request.body as T;
}

export function getValidatedParams<T>(request: Request): T {
	return request.params as unknown as T;
}

export function getValidatedQuery<T>(request: Request): T {
	return request.query as unknown as T;
}
