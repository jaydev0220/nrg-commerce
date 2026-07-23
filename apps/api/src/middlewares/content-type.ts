import type { RequestHandler } from 'express';

import { AppError } from '../errors/app-error.js';

function hasRequestBody(contentLength: string | undefined, transferEncoding: string | undefined) {
	if (transferEncoding) return true;
	if (!contentLength) return false;

	const parsedLength = Number(contentLength);
	return !Number.isFinite(parsedLength) || parsedLength > 0;
}

export const requireJsonRequestBody: RequestHandler = (request, _response, next) => {
	if (
		!hasRequestBody(request.get('content-length'), request.get('transfer-encoding')) ||
		request.is(['application/json', 'application/*+json'])
	) {
		next();
		return;
	}

	next(
		new AppError(
			415,
			'UNSUPPORTED_MEDIA_TYPE',
			'Request bodies must use the application/json media type.'
		)
	);
};
