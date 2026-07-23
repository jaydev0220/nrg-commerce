import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { getDatabaseClient } from '@packages/database';

import { readAppConfig, type AppConfig } from './config/app-config.js';
import { AppError } from './errors/app-error.js';
import { createErrorHandler } from './errors/error-handler.js';
import { redactLogValue, serializeLogError } from './logging/log-redaction.js';
import { createAuthenticateMiddleware } from './middlewares/authenticate.js';
import { requireJsonRequestBody } from './middlewares/content-type.js';
import { resolveAuthCookieNames } from './utils/auth-cookies.js';
import { createGlobalRateLimiter } from './middlewares/rate-limit.js';
import { createRequestLogger } from './middlewares/request-logging.js';
import { createRequestContextMiddleware } from './middlewares/request-context.js';
import type { HealthDependencies } from './health/health.routes.js';
import { createPrismaAuthRepository } from './modules/auth/auth.repository.js';
import { startAuthSessionRetentionPruner } from './modules/auth/auth-retention.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createPrismaCatalogRepository } from './modules/management/catalog.repository.js';
import { createPrismaBusinessRepository } from './modules/management/business/business.repository.js';
import { createBusinessService } from './modules/management/business/business.service.js';
import { createPrismaBusinessLabelRepository } from './modules/management/business/label.repository.js';
import { createBusinessLabelService } from './modules/management/business/label.service.js';
import { createCategoryService } from './modules/management/category/category.service.js';
import { createDashboardService } from './modules/management/dashboard/dashboard.service.js';
import { createImageService } from './modules/management/image/image.service.js';
import { startImageRetentionPruner } from './modules/management/image/image-retention.js';
import { createPrismaLogRepository } from './modules/management/log/log.repository.js';
import { startLogRetentionPruner } from './modules/management/log/log-retention.js';
import { createLogService } from './modules/management/log/log.service.js';
import { createPrismaOrderRepository } from './modules/management/order/order.repository.js';
import { createOrderService } from './modules/management/order/order.service.js';
import { createProductService } from './modules/management/product/product.service.js';
import { createSkuService } from './modules/management/sku/sku.service.js';
import { createPrismaStaffRepository } from './modules/management/staff/staff.repository.js';
import { createStaffService } from './modules/management/staff/staff.service.js';
import { createPrismaStorefrontCatalogRepository } from './modules/storefront/storefront.repository.js';
import { createCachedStorefrontCatalogService } from './modules/storefront/storefront.cached-service.js';
import { createStorefrontCatalogService } from './modules/storefront/storefront.service.js';
import { initializeRoutes } from './routes/index.js';
import { createApiLogger } from './logging/logger.js';
import { hashRefreshToken } from './utils/crypto.js';
import { createR2ObjectStorage } from './utils/object-storage.js';
import { createPasskeyService } from './utils/passkey-service.js';
import { createPasswordHasher } from './utils/password-hasher.js';
import { createTokenService } from './utils/token-service.js';
import { createTotpService } from './utils/totp-service.js';

type AppDependencies = {
	config?: AppConfig;
	health?: HealthDependencies;
	registerCleanup?: (cleanup: () => void) => void;
};

export function createApp(dependencies: AppDependencies = {}) {
	const config = dependencies.config ?? readAppConfig();
	const database = getDatabaseClient({
		connectionString: config.databaseUrl,
		maxConnections: config.databaseMaxConnections
	});
	const authRepository = createPrismaAuthRepository(database);
	const staffRepository = createPrismaStaffRepository(database);
	const logRepository = createPrismaLogRepository(database);
	const managementCatalogRepository = createPrismaCatalogRepository(database);
	const businessRepository = createPrismaBusinessRepository(database);
	const businessLabelRepository = createPrismaBusinessLabelRepository(database);
	const orderRepository = createPrismaOrderRepository(database);
	const storefrontCatalogRepository = createPrismaStorefrontCatalogRepository(database);
	const logger = createApiLogger({ level: config.logLevel });
	const passwordHasher = createPasswordHasher();
	const tokenService = createTokenService({
		accessTokenSecret: config.accessTokenSecret,
		refreshTokenSecret: config.refreshTokenSecret,
		pendingTokenSecret: config.pendingTokenSecret,
		issuer: config.jwtIssuer,
		audience: config.jwtAudience,
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
		sessionTtlSeconds: config.sessionTtlSeconds,
		sessionAbsoluteTtlSeconds: config.sessionAbsoluteTtlSeconds,
		recordAuthDiagnostic: (event) =>
			logger.warn(event, 'Authentication session refresh diagnostic.')
	});
	const staffService = createStaffService({
		repository: staffRepository,
		passwordHasher
	});
	const logService = createLogService({
		repository: logRepository,
		onAuditLogPersistenceError: (error) =>
			logger.error(
				{ error: redactLogValue(serializeLogError(error)) },
				'Failed to persist API audit log.'
			)
	});
	const requestLogger = createRequestLogger({
		logger,
		logService,
		minimumLevel: config.logLevel
	});
	const dashboardService = createDashboardService({
		database
	});
	const businessService = createBusinessService({
		repository: businessRepository
	});
	const labelService = createBusinessLabelService({
		repository: businessLabelRepository
	});
	const orderService = createOrderService({
		repository: orderRepository
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
		uploadBucketName: config.r2UploadBucketName,
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
	const storefrontService = createCachedStorefrontCatalogService(
		createStorefrontCatalogService({ repository: storefrontCatalogRepository }),
		{
			ttlMs: config.storefrontCacheTtlSeconds * 1000,
			maxEntries: config.storefrontCacheMaxEntries,
			logger
		}
	);
	const authenticate = createAuthenticateMiddleware(
		authService,
		resolveAuthCookieNames(config.cookieSecure).access
	);
	const app = express();

	if (config.nodeEnv !== 'test') {
		const authSessionRetentionPruner = startAuthSessionRetentionPruner({
			repository: authRepository,
			onError: (error) =>
				logger.error(
					{ error: redactLogValue(serializeLogError(error)) },
					'Failed to prune expired authentication sessions.'
				)
		});
		const logRetentionPruner = startLogRetentionPruner({
			logService,
			onError: (error) =>
				logger.error(
					{ error: redactLogValue(serializeLogError(error)) },
					'Failed to prune expired logs.'
				)
		});
		const imageRetentionPruner = startImageRetentionPruner({
			imageService,
			onError: (error) =>
				logger.error(
					{ error: redactLogValue(serializeLogError(error)) },
					'Failed to prune product image assets.'
				)
		});
		dependencies.registerCleanup?.(() => {
			authSessionRetentionPruner.stop();
			logRetentionPruner.stop();
			imageRetentionPruner.stop();
		});
	}

	if (config.trustProxyHops !== false) {
		app.set('trust proxy', config.trustProxyHops);
	}

	app.use(createRequestContextMiddleware());
	app.use(requestLogger.middleware);
	app.use(helmet());

	app.use(
		cors({
			credentials: true,
			allowedHeaders: ['content-type', 'x-csrf-token', 'idempotency-key'],
			origin(origin, callback) {
				if (!origin || config.corsOrigins.includes(origin)) {
					callback(null, true);
					return;
				}

				callback(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'The request origin is not allowed.'));
			}
		})
	);
	app.use(createGlobalRateLimiter(config));
	app.use(requireJsonRequestBody);
	app.use(express.json({ limit: config.bodyLimit }));

	initializeRoutes(app, {
		config,
		errorHandler: createErrorHandler(() => undefined, requestLogger.recordError),
		health: dependencies.health ?? {
			isReady: async () => {
				await database.$queryRaw`SELECT 1`;
				return true;
			},
			logger
		},
		authService,
		authenticate,
		staffService,
		logService,
		dashboardService,
		businessService,
		labelService,
		orderService,
		productService,
		categoryService,
		skuService,
		imageService,
		storefrontService
	});

	return app;
}
