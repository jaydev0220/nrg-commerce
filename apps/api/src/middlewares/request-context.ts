import type { Request, RequestHandler, Response } from 'express';

type RequestContext = {
	requestId: string;
};

type RequestContextLocals = {
	requestContext?: RequestContext;
};

const externalRequestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function resolveRequestId(request: Request, createId: () => string): string {
	const headerValue = request.get('x-request-id')?.trim();

	return headerValue && externalRequestIdPattern.test(headerValue) ? headerValue : createId();
}

export function createRequestContextMiddleware(
	createId: () => string = () => crypto.randomUUID()
): RequestHandler {
	return (request, response, next) => {
		const requestId = resolveRequestId(request, createId);
		(response.locals as RequestContextLocals).requestContext = { requestId };
		response.setHeader('x-request-id', requestId);
		next();
	};
}

export function getRequestContext(request: Request, response: Response): RequestContext {
	const locals = response.locals as RequestContextLocals;

	if (!locals.requestContext) {
		locals.requestContext = {
			requestId: resolveRequestId(request, () => crypto.randomUUID())
		};
	}

	return locals.requestContext;
}

export function getRequestPath(request: Request): string {
	return request.originalUrl.split('?')[0] || request.path;
}
