import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { getDatabaseClient } from '@packages/database';

import { readAppConfig, type AppConfig } from './config/app-config.js';
import { createAuthenticateMiddleware } from './middlewares/authenticate.js';
import { createGlobalRateLimiter } from './middlewares/rate-limit.js';
import type { HealthDependencies } from './health/health.routes.js';
import { createPrismaAuthRepository } from './modules/auth/auth.repository.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createPrismaCatalogRepository } from './modules/management/catalog.repository.js';
import { createCategoryService } from './modules/management/category/category.service.js';
import { createImageService } from './modules/management/image/image.service.js';
import { createProductService } from './modules/management/product/product.service.js';
import { createSkuService } from './modules/management/sku/sku.service.js';
import { createPrismaStaffRepository } from './modules/management/staff/staff.repository.js';
import { createStaffService } from './modules/management/staff/staff.service.js';
import { createPrismaStorefrontCatalogRepository } from './modules/storefront/storefront.repository.js';
import { createStorefrontCatalogService } from './modules/storefront/storefront.service.js';
import { initializeRoutes } from './routes/index.js';
import { hashRefreshToken } from './utils/crypto.js';
import { createR2ObjectStorage } from './utils/object-storage.js';
import { createPasskeyService } from './utils/passkey-service.js';
import { createPasswordHasher } from './utils/password-hasher.js';
import { createTokenService } from './utils/token-service.js';
import { createTotpService } from './utils/totp-service.js';

type AppDependencies = {
	config?: AppConfig;
	health?: HealthDependencies;
};

export function createApp(dependencies: AppDependencies = {}) {
	const config = dependencies.config ?? readAppConfig();
	const database = getDatabaseClient();
	const authRepository = createPrismaAuthRepository(database);
	const staffRepository = createPrismaStaffRepository(database);
	const managementCatalogRepository = createPrismaCatalogRepository(database);
	const storefrontCatalogRepository = createPrismaStorefrontCatalogRepository(database);
	const passwordHasher = createPasswordHasher();
	const tokenService = createTokenService({
		accessTokenSecret: config.accessTokenSecret,
		refreshTokenSecret: config.refreshTokenSecret,
		pendingTokenSecret: config.pendingTokenSecret,
		accessTokenTtlSeconds: config.accessTokenTtlSeconds,
		refreshTokenTtlSeconds: config.refreshTokenTtlSeconds,
		pendingTokenTtlSeconds: config.pendingTokenTtlSeconds
	});
	const totpService = createTotpService({
		issuer: config.totpIssuer,
		encryptionSecret: config.dataEncryptionSecret
	});
	const passkeyService = createPasskeyService({
		rpId: config.webauthnRpId,
		rpName: config.webauthnRpName,
		origin: config.webauthnOrigin
	});
	const authService = createAuthService({
		repository: authRepository,
		passwordHasher,
		tokenService,
		totpService,
		passkeyService,
		now: () => new Date(),
		createId: () => crypto.randomUUID(),
		hashRefreshToken,
		sessionTtlSeconds: config.sessionTtlSeconds
	});
	const staffService = createStaffService({
		repository: staffRepository,
		passwordHasher
	});
	const categoryService = createCategoryService({
		repository: managementCatalogRepository
	});
	const productService = createProductService({
		repository: managementCatalogRepository
	});
	const skuService = createSkuService({
		repository: managementCatalogRepository
	});
	const objectStorage = createR2ObjectStorage({
		accountId: config.r2AccountId,
		bucketName: config.r2BucketName,
		accessKeyId: config.r2AccessKeyId,
		secretAccessKey: config.r2SecretAccessKey,
		publicBaseUrl: config.r2PublicBaseUrl,
		assetKeyPrefix: config.r2AssetKeyPrefix,
		uploadUrlTtlSeconds: config.r2UploadUrlTtlSeconds
	});
	const imageService = createImageService({
		repository: managementCatalogRepository,
		objectStorage
	});
	const storefrontService = createStorefrontCatalogService({
		repository: storefrontCatalogRepository
	});
	const authenticate = createAuthenticateMiddleware(authService);
	const app = express();

	if (config.trustProxy) {
		app.set('trust proxy', 1);
	}

	app.use(
		cors({
			credentials: true,
			origin(origin, callback) {
				if (!origin || config.corsOrigins.includes(origin)) {
					callback(null, true);
					return;
				}

				callback(new Error('Origin is not allowed by CORS.'));
			}
		})
	);
	app.use(helmet());
	app.use(express.json({ limit: config.bodyLimit }));
	app.use(express.urlencoded({ extended: false, limit: config.bodyLimit }));
	app.use(createGlobalRateLimiter(config));

	initializeRoutes(app, {
		config,
		health: dependencies.health,
		authService,
		authenticate,
		staffService,
		productService,
		categoryService,
		skuService,
		imageService,
		storefrontService
	});

	return app;
}
