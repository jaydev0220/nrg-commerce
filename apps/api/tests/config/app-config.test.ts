import assert from 'node:assert/strict';
import test from 'node:test';

import { readAppConfig } from '../../src/config/app-config.js';

const validProductionEnvironment = {
	NODE_ENV: 'production',
	DATABASE_URL:
		'postgresql://api:password@database.example.com:5432/nrg_commerce?sslmode=verify-full',
	CORS_ORIGINS: 'https://admin.example.com',
	ACCESS_TOKEN_SECRET: 'access-token-secret-0123456789abcdef',
	REFRESH_TOKEN_SECRET: 'refresh-token-secret-0123456789abcdef',
	PENDING_TOKEN_SECRET: 'pending-token-secret-0123456789abcdef',
	DATA_ENCRYPTION_SECRET: 'data-encryption-secret-0123456789abcdef',
	JWT_ISSUER: 'https://api.example.com',
	JWT_AUDIENCE: 'nrg-commerce-admin',
	TRUST_PROXY_HOPS: '1',
	WEBAUTHN_RP_ID: 'example.com',
	WEBAUTHN_RP_NAME: 'NRG Commerce',
	WEBAUTHN_ORIGIN: 'https://admin.example.com',
	R2_ACCOUNT_ID: 'account-id',
	R2_BUCKET_NAME: 'product-assets',
	R2_UPLOAD_BUCKET_NAME: 'product-uploads',
	R2_ACCESS_KEY_ID: 'access-key-id',
	R2_SECRET_ACCESS_KEY: 'r2-secret-access-key',
	R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
	OTEL_EXPORTER_OTLP_ENDPOINT: 'https://telemetry.example.com'
} satisfies NodeJS.ProcessEnv;

test('development config supports the admin preview and Vite origins', () => {
	const config = readAppConfig({ NODE_ENV: 'development' });

	assert.equal(config.cookieSecure, false);
	assert.equal(config.cookieSameSite, 'lax');
	assert.equal(config.logLevel, 'debug');
	assert.deepEqual(config.corsOrigins, ['http://localhost:4173', 'http://localhost:5173']);
	assert.equal(config.otelExporterOtlpEndpoint, null);
	assert.equal(config.otelServiceName, 'nrg-commerce-api');
	assert.equal(config.otelMetricExportIntervalMs, 60_000);
});

test('production config defaults to cross-origin secure cookies', () => {
	const config = readAppConfig(validProductionEnvironment);

	assert.equal(config.cookieSecure, true);
	assert.equal(config.cookieSameSite, 'none');
	assert.equal(config.logLevel, 'info');
	assert.equal(config.otelExporterOtlpEndpoint, 'https://telemetry.example.com');
});

test('production config requires every service setting without exposing values', () => {
	assert.throws(
		() => readAppConfig({ NODE_ENV: 'production', ACCESS_TOKEN_SECRET: 'do-not-expose' }),
		(error: Error) => {
			assert.match(error.message, /Production configuration is missing/);
			assert.doesNotMatch(error.message, /do-not-expose/);
			return true;
		}
	);
});

test('production secrets must be strong and pairwise distinct', () => {
	assert.throws(
		() => readAppConfig({ ...validProductionEnvironment, ACCESS_TOKEN_SECRET: 'short' }),
		/ACCESS_TOKEN_SECRET/
	);
	assert.throws(
		() =>
			readAppConfig({
				...validProductionEnvironment,
				REFRESH_TOKEN_SECRET: validProductionEnvironment.ACCESS_TOKEN_SECRET
			}),
		/pairwise distinct/
	);
});

test('production origins must use non-local HTTPS URLs', () => {
	assert.throws(
		() => readAppConfig({ ...validProductionEnvironment, CORS_ORIGINS: 'http://localhost:5173' }),
		/CORS_ORIGINS/
	);
	assert.throws(
		() => readAppConfig({ ...validProductionEnvironment, CORS_ORIGINS: ',' }),
		/CORS_ORIGINS/
	);
	assert.throws(
		() =>
			readAppConfig({
				...validProductionEnvironment,
				CORS_ORIGINS: 'https://admin.example.com/path'
			}),
		/CORS_ORIGINS/
	);
	assert.throws(
		() => readAppConfig({ ...validProductionEnvironment, WEBAUTHN_RP_ID: 'localhost' }),
		/WEBAUTHN_RP_ID/
	);
	assert.throws(
		() => readAppConfig({ ...validProductionEnvironment, WEBAUTHN_RP_ID: 'example.com/path' }),
		/WEBAUTHN_RP_ID/
	);
	assert.throws(
		() => readAppConfig({ ...validProductionEnvironment, WEBAUTHN_ORIGIN: 'not-a-url' }),
		/WEBAUTHN_ORIGIN/
	);
	assert.throws(
		() =>
			readAppConfig({
				...validProductionEnvironment,
				WEBAUTHN_RP_ID: 'another.example.com'
			}),
		/WEBAUTHN_RP_ID/
	);
	assert.throws(
		() =>
			readAppConfig({
				...validProductionEnvironment,
				CORS_ORIGINS: 'https://catalog.example.com'
			}),
		/WEBAUTHN_ORIGIN/
	);
	assert.throws(
		() => readAppConfig({ ...validProductionEnvironment, R2_PUBLIC_BASE_URL: 'http://cdn.test' }),
		/R2_PUBLIC_BASE_URL/
	);
	assert.throws(
		() =>
			readAppConfig({
				...validProductionEnvironment,
				R2_PUBLIC_BASE_URL: 'https://cdn.example.com/assets?token=secret'
			}),
		/R2_PUBLIC_BASE_URL/
	);
	assert.throws(
		() =>
			readAppConfig({
				...validProductionEnvironment,
				R2_UPLOAD_BUCKET_NAME: validProductionEnvironment.R2_BUCKET_NAME
			}),
		/R2_UPLOAD_BUCKET_NAME/
	);
});

test('production database and cookie settings are validated', () => {
	assert.throws(
		() =>
			readAppConfig({
				...validProductionEnvironment,
				DATABASE_URL: 'mysql://database.example.com'
			}),
		/DATABASE_URL/
	);
	assert.throws(
		() =>
			readAppConfig({
				...validProductionEnvironment,
				DATABASE_URL: 'postgresql://api:password@database.example.com:5432/nrg_commerce'
			}),
		/sslmode=verify-full/
	);
	assert.throws(
		() =>
			readAppConfig({
				...validProductionEnvironment,
				DATABASE_URL:
					'postgresql://api:password@database.example.com:5432/nrg_commerce?sslmode=require'
			}),
		/sslmode=verify-full/
	);
	assert.throws(
		() => readAppConfig({ ...validProductionEnvironment, COOKIE_SECURE: 'false' }),
		/COOKIE_SECURE/
	);
});

test('database pool size defaults to ten and accepts positive integers', () => {
	assert.equal(readAppConfig({}).databaseMaxConnections, 10);
	assert.equal(readAppConfig({ DATABASE_MAX_CONNECTIONS: '4' }).databaseMaxConnections, 4);
	assert.throws(
		() => readAppConfig({ DATABASE_MAX_CONNECTIONS: '0' }),
		/DATABASE_MAX_CONNECTIONS must be a positive integer/
	);
	assert.throws(
		() => readAppConfig({ DATABASE_MAX_CONNECTIONS: '101' }),
		/DATABASE_MAX_CONNECTIONS/
	);
});

test('security and resource configuration values stay within operational bounds', () => {
	assert.throws(() => readAppConfig({ TRUST_PROXY_HOPS: '6' }), /TRUST_PROXY_HOPS/);
	assert.throws(
		() => readAppConfig({ ACCESS_TOKEN_TTL_SECONDS: '30' }),
		/ACCESS_TOKEN_TTL_SECONDS/
	);
	assert.throws(
		() => readAppConfig({ REFRESH_TOKEN_TTL_SECONDS: '3600', ACCESS_TOKEN_TTL_SECONDS: '7200' }),
		/ACCESS_TOKEN_TTL_SECONDS/
	);
	assert.throws(
		() =>
			readAppConfig({
				REFRESH_TOKEN_TTL_SECONDS: '604800',
				SESSION_ABSOLUTE_TTL_SECONDS: '3600'
			}),
		/REFRESH_TOKEN_TTL_SECONDS/
	);
	assert.throws(
		() => readAppConfig({ R2_UPLOAD_URL_TTL_SECONDS: '3601' }),
		/R2_UPLOAD_URL_TTL_SECONDS/
	);
	assert.throws(
		() => readAppConfig({ STOREFRONT_CACHE_MAX_ENTRIES: '5001' }),
		/STOREFRONT_CACHE_MAX_ENTRIES/
	);
	assert.throws(
		() => readAppConfig({ RATE_LIMIT_MAX: '10', AUTH_RATE_LIMIT_MAX: '11' }),
		/AUTH_RATE_LIMIT_MAX/
	);
	assert.throws(() => readAppConfig({ R2_ASSET_KEY_PREFIX: '' }), /R2_ASSET_KEY_PREFIX/);
});

test('CORS configuration rejects duplicate or excessive origins', () => {
	assert.throws(
		() => readAppConfig({ CORS_ORIGINS: 'https://admin.example.com,https://admin.example.com' }),
		/CORS_ORIGINS/
	);
	assert.throws(
		() =>
			readAppConfig({
				CORS_ORIGINS: Array.from(
					{ length: 21 },
					(_value, index) => `https://admin-${index}.example.com`
				).join(',')
			}),
		/CORS_ORIGINS/
	);
});

test('configured log levels are accepted', () => {
	assert.equal(readAppConfig({ LOG_LEVEL: 'warn' }).logLevel, 'warn');
});

test('session config provides sliding and absolute lifetime defaults', () => {
	const config = readAppConfig({});

	assert.equal(config.sessionTtlSeconds, 604_800);
	assert.equal(config.sessionAbsoluteTtlSeconds, 2_592_000);
	assert.equal(
		readAppConfig({ SESSION_ABSOLUTE_TTL_SECONDS: '1209600' }).sessionAbsoluteTtlSeconds,
		1_209_600
	);
});

test('storefront cache configuration has bounded defaults and accepts positive integers', () => {
	const defaults = readAppConfig({});
	assert.equal(defaults.storefrontCacheTtlSeconds, 60);
	assert.equal(defaults.storefrontCacheMaxEntries, 500);

	const configured = readAppConfig({
		STOREFRONT_CACHE_TTL_SECONDS: '30',
		STOREFRONT_CACHE_MAX_ENTRIES: '25'
	});
	assert.equal(configured.storefrontCacheTtlSeconds, 30);
	assert.equal(configured.storefrontCacheMaxEntries, 25);
	assert.throws(
		() => readAppConfig({ STOREFRONT_CACHE_TTL_SECONDS: '0' }),
		/STOREFRONT_CACHE_TTL_SECONDS must be a positive integer/
	);
});

test('OTLP export configuration validates endpoints and metric intervals', () => {
	const config = readAppConfig({
		OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector.internal:4318/otel',
		OTEL_SERVICE_NAME: 'commerce-api',
		OTEL_METRIC_EXPORT_INTERVAL_MS: '15000'
	});
	assert.equal(config.otelExporterOtlpEndpoint, 'http://collector.internal:4318/otel');
	assert.equal(config.otelServiceName, 'commerce-api');
	assert.equal(config.otelMetricExportIntervalMs, 15_000);

	assert.throws(
		() => readAppConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: 'ftp://collector.example.com' }),
		/OTEL_EXPORTER_OTLP_ENDPOINT/
	);
	assert.throws(
		() =>
			readAppConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: 'https://user:secret@collector.example.com' }),
		/OTEL_EXPORTER_OTLP_ENDPOINT/
	);
	assert.throws(
		() => readAppConfig({ OTEL_METRIC_EXPORT_INTERVAL_MS: '999' }),
		/OTEL_METRIC_EXPORT_INTERVAL_MS/
	);
	assert.throws(
		() => readAppConfig({ OTEL_METRIC_EXPORT_INTERVAL_MS: '300001' }),
		/OTEL_METRIC_EXPORT_INTERVAL_MS/
	);
});

test('production requires an OTLP endpoint', () => {
	const environment: NodeJS.ProcessEnv = { ...validProductionEnvironment };
	delete environment['OTEL_EXPORTER_OTLP_ENDPOINT'];

	assert.throws(() => readAppConfig(environment), /OTEL_EXPORTER_OTLP_ENDPOINT/);
});

test('unsupported log levels fail configuration loading', () => {
	assert.throws(
		() => readAppConfig({ LOG_LEVEL: 'verbose' }),
		/LOG_LEVEL must be one of debug, info, warn, error, or fatal/
	);
});

test('SameSite none cookies require the Secure attribute', () => {
	assert.throws(
		() =>
			readAppConfig({
				COOKIE_SECURE: 'false',
				COOKIE_SAME_SITE: 'none'
			}),
		/COOKIE_SECURE must be true/
	);
});

test('configured booleans, numbers, and enums fail closed', () => {
	assert.throws(
		() => readAppConfig({ COOKIE_SECURE: 'yes' }),
		/COOKIE_SECURE must be true or false/
	);
	assert.throws(() => readAppConfig({ RATE_LIMIT_MAX: 'NaN' }), /RATE_LIMIT_MAX/);
	assert.throws(() => readAppConfig({ PORT: '65536' }), /PORT must be between/);
	assert.throws(() => readAppConfig({ COOKIE_SAME_SITE: 'invalid' }), /COOKIE_SAME_SITE/);
	assert.throws(() => readAppConfig({ NODE_ENV: 'staging' }), /NODE_ENV/);
});

test('request body limits are bounded to prevent unsafe production configuration', () => {
	assert.equal(readAppConfig({ BODY_LIMIT: '1mb' }).bodyLimit, '1mb');
	assert.throws(() => readAppConfig({ BODY_LIMIT: '2mb' }), /BODY_LIMIT must be between/);
	assert.throws(() => readAppConfig({ BODY_LIMIT: '512b' }), /BODY_LIMIT must be between/);
});
