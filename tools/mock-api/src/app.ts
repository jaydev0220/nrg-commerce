import express, { type RequestHandler } from 'express';
import type { MockApiConfig } from './config.js';
import { errorHandler, MockHttpError, notFoundHandler } from './http/errors.js';
import { localCors } from './http/cors.js';
import { createAuthRouter, csrfHeaderIsValid } from './routes/auth.js';
import { createBusinessesRouter } from './routes/businesses.js';
import { createCategoriesRouter } from './routes/categories.js';
import { createDashboardRouter } from './routes/dashboard.js';
import { createImageRouter, createMockAssetRouter } from './routes/images.js';
import { createLogsRouter } from './routes/logs.js';
import { createOrdersRouter } from './routes/orders.js';
import { createProductsRouter } from './routes/products.js';
import { createStaffRouter } from './routes/staff.js';
import { createStorefrontRouter } from './routes/storefront.js';
import type { MockState } from './state.js';

const requireCsrf: RequestHandler = (request, _response, next) => {
	if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
		next();
		return;
	}
	if (!csrfHeaderIsValid(request.header('x-csrf-token'))) {
		next(
			new MockHttpError(403, 'CSRF_VALIDATION_FAILED', 'The mock CSRF token is missing or invalid.')
		);
		return;
	}
	next();
};

export function createApp(state: MockState, config: MockApiConfig) {
	const app = express();
	app.disable('x-powered-by');
	app.use(localCors);
	app.use('/mock', createMockAssetRouter(state));
	app.use(express.json({ limit: '1mb' }));
	app.get('/health', (_request, response) => {
		response.json({ status: 'ok', scenario: config.scenario });
	});
	app.use('/api', requireCsrf);
	app.use('/api/auth', createAuthRouter(state));
	app.use('/api/management/products/categories', createCategoriesRouter(state));
	app.use('/api/management/products', createImageRouter(state, config.publicOrigin));
	app.use('/api/management/products', createProductsRouter(state, config.publicOrigin));
	app.use('/api/management/businesses', createBusinessesRouter(state));
	app.use('/api/management/orders', createOrdersRouter(state));
	app.use('/api/management/staff', createStaffRouter(state));
	app.use('/api/management/logs', createLogsRouter(state));
	app.use('/api/management/dashboard', createDashboardRouter(state));
	app.use('/api/storefront', createStorefrontRouter(state, config.publicOrigin));
	app.use(notFoundHandler);
	app.use(errorHandler);
	return app;
}
