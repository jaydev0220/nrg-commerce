import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import { errorHandler } from '../src/errors/error-handler.js';
import { createCatalogManagementRouter } from '../src/modules/management/management.routes.js';
import type { AuthenticatedStaffContext } from '../src/types/auth.js';
import { createApp } from '../src/app.js';
import { initializeRoutes } from '../src/routes/index.js';
import { requestApp } from './helpers/http.js';

function createTestConfig() {
	return {
		nodeEnv: 'test' as const,
		port: 0,
		trustProxy: false,
		corsOrigins: ['http://localhost:4173'],
		bodyLimit: '64kb',
		accessTokenSecret: 'access-secret',
		refreshTokenSecret: 'refresh-secret',
		pendingTokenSecret: 'pending-secret',
		dataEncryptionSecret: 'data-secret',
		accessTokenTtlSeconds: 900,
		refreshTokenTtlSeconds: 86_400,
		pendingTokenTtlSeconds: 300,
		sessionTtlSeconds: 86_400,
		totpIssuer: 'NRG Commerce',
		webauthnRpId: 'localhost',
		webauthnRpName: 'NRG Commerce',
		webauthnOrigin: 'http://localhost:4173',
		rateLimitWindowMs: 60_000,
		rateLimitMax: 100,
		authRateLimitMax: 10,
		r2AccountId: 'account-id',
		r2BucketName: 'catalog-assets',
		r2AccessKeyId: 'access-key-id',
		r2SecretAccessKey: 'secret-access-key',
		r2PublicBaseUrl: 'https://assets.example.com',
		r2AssetKeyPrefix: 'products/skus',
		r2UploadUrlTtlSeconds: 900
	};
}

function createManagementAuthContext(): AuthenticatedStaffContext {
	return {
		staffId: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
		sessionId: '0189076c-4f2a-7fe1-b9fd-2d68df455112',
		roles: ['admin'],
		permissions: ['product.image.create'],
		mfa: ['authenticator'],
		primaryFactor: 'password',
		staff: {
			id: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
			email: 'admin@example.com',
			name: 'Admin',
			status: 'active',
			passwordHash: null,
			mfaRequired: true,
			preferredMfaMethod: 'authenticator',
			lastLoginAt: null,
			roles: [],
			totpCredentialCount: 1,
			passkeyCredentialCount: 0
		}
	};
}

test('createApp exposes liveness and readiness health endpoints', async () => {
	const app = createApp({
		config: createTestConfig(),
		health: {
			isReady: async () => true
		}
	});

	const livenessResponse = await requestApp(app, {
		path: '/health/liveness'
	});
	const readinessResponse = await requestApp(app, {
		path: '/health/readiness'
	});

	assert.equal(livenessResponse.status, 200);
	assert.equal(readinessResponse.status, 200);
	assert.deepEqual(livenessResponse.json(), { status: 'ok' });
	assert.deepEqual(readinessResponse.json(), { status: 'ready' });
});

test('management routes require authentication', async () => {
	const app = createApp({
		config: createTestConfig(),
		health: {
			isReady: async () => true
		}
	});

	const response = await requestApp(app, {
		path: '/api/management/staff'
	});
	const payload = response.json<{ error: { code: string } }>();

	assert.equal(response.status, 401);
	assert.equal(payload.error.code, 'AUTHENTICATION_REQUIRED');
});

test('management upload noop route is not exposed', async () => {
	const app = express();

	initializeRoutes(app, {
		config: createTestConfig(),
		authService: {} as Parameters<typeof initializeRoutes>[1]['authService'],
		authenticate: (_request, _response, next) => {
			next();
		},
		staffService: {} as Parameters<typeof initializeRoutes>[1]['staffService'],
		logService: {} as Parameters<typeof initializeRoutes>[1]['logService'],
		productService: {} as Parameters<typeof initializeRoutes>[1]['productService'],
		categoryService: {} as Parameters<typeof initializeRoutes>[1]['categoryService'],
		skuService: {} as Parameters<typeof initializeRoutes>[1]['skuService'],
		imageService: {} as Parameters<typeof initializeRoutes>[1]['imageService'],
		storefrontService: {} as Parameters<typeof initializeRoutes>[1]['storefrontService']
	});

	const response = await requestApp(app, {
		method: 'POST',
		path: '/api/management/uploads/noop'
	});
	const payload = response.json<{ error: { code: string } }>();

	assert.equal(response.status, 404);
	assert.equal(payload.error.code, 'ROUTE_NOT_FOUND');
});

test('management product image upload-url route returns a presigned upload target', async () => {
	const app = express();
	app.use(express.json());
	app.use((_request, response, next) => {
		response.locals['auth'] = createManagementAuthContext();
		next();
	});
	app.use(
		'/api/management/products',
		createCatalogManagementRouter({
			productService: {} as Parameters<typeof createCatalogManagementRouter>[0]['productService'],
			categoryService: {} as Parameters<typeof createCatalogManagementRouter>[0]['categoryService'],
			skuService: {} as Parameters<typeof createCatalogManagementRouter>[0]['skuService'],
			imageService: {
				createImageUploadTarget: async () => ({
					method: 'PUT',
					assetKey: 'products/skus/sku-1/image.png',
					imageUrl: 'https://assets.example.com/products/skus/sku-1/image.png',
					uploadUrl: 'https://signed-upload.example.com',
					headers: {
						'Content-Type': 'image/png'
					},
					expiresAt: '2026-06-13T10:15:00.000Z'
				}),
				listImages: async () => ({ data: [], total: 0 }),
				getImage: async () => {
					throw new Error('not used');
				},
				createImage: async () => {
					throw new Error('not used');
				},
				deleteImage: async () => {
					throw new Error('not used');
				}
			}
		})
	);
	app.use(errorHandler);

	const response = await requestApp(app, {
		method: 'POST',
		path: '/api/management/products/skus/93f99825-2962-4a10-b453-daa375ff1c43/images/upload-url',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			fileName: 'front.png',
			contentType: 'image/png'
		})
	});
	const payload = response.json<{
		method: string;
		assetKey: string;
		uploadUrl: string;
		headers: Record<string, string>;
	}>();

	assert.equal(response.status, 200);
	assert.equal(payload.method, 'PUT');
	assert.equal(payload.assetKey, 'products/skus/sku-1/image.png');
	assert.equal(payload.uploadUrl, 'https://signed-upload.example.com');
	assert.deepEqual(payload.headers, {
		'Content-Type': 'image/png'
	});
});
