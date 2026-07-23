import { createHash } from 'node:crypto';
import type { LogLevel } from '@packages/database';
import { z } from 'zod';

export type AppConfig = {
	nodeEnv: string;
	port: number;
	databaseUrl: string;
	databaseMaxConnections: number;
	trustProxyHops: number | false;
	corsOrigins: string[];
	bodyLimit: string;
	logLevel: LogLevel;
	cookieSecure: boolean;
	cookieSameSite: 'lax' | 'strict' | 'none';
	accessTokenSecret: string;
	refreshTokenSecret: string;
	pendingTokenSecret: string;
	dataEncryptionSecret: string;
	jwtIssuer: string;
	jwtAudience: string;
	accessTokenTtlSeconds: number;
	refreshTokenTtlSeconds: number;
	pendingTokenTtlSeconds: number;
	sessionTtlSeconds: number;
	sessionAbsoluteTtlSeconds: number;
	totpIssuer: string;
	webauthnRpId: string;
	webauthnRpName: string;
	webauthnOrigin: string;
	rateLimitWindowMs: number;
	rateLimitMax: number;
	authRateLimitMax: number;
	r2AccountId: string;
	r2BucketName: string;
	r2UploadBucketName: string;
	r2AccessKeyId: string;
	r2SecretAccessKey: string;
	r2PublicBaseUrl: string;
	r2AssetKeyPrefix: string;
	r2UploadUrlTtlSeconds: number;
	storefrontCacheTtlSeconds: number;
	storefrontCacheMaxEntries: number;
	otelExporterOtlpEndpoint: string | null;
	otelServiceName: string;
	otelMetricExportIntervalMs: number;
};

const fallbackDatabaseUrl = 'postgresql://postgres:postgres@localhost:5432/nrg_commerce';
const productionRequiredVariables = [
	'DATABASE_URL',
	'CORS_ORIGINS',
	'ACCESS_TOKEN_SECRET',
	'REFRESH_TOKEN_SECRET',
	'PENDING_TOKEN_SECRET',
	'DATA_ENCRYPTION_SECRET',
	'JWT_ISSUER',
	'JWT_AUDIENCE',
	'TRUST_PROXY_HOPS',
	'WEBAUTHN_RP_ID',
	'WEBAUTHN_RP_NAME',
	'WEBAUTHN_ORIGIN',
	'R2_ACCOUNT_ID',
	'R2_BUCKET_NAME',
	'R2_UPLOAD_BUCKET_NAME',
	'R2_ACCESS_KEY_ID',
	'R2_SECRET_ACCESS_KEY',
	'R2_PUBLIC_BASE_URL',
	'OTEL_EXPORTER_OTLP_ENDPOINT'
] as const;

const productionSecretVariables = [
	'ACCESS_TOKEN_SECRET',
	'REFRESH_TOKEN_SECRET',
	'PENDING_TOKEN_SECRET',
	'DATA_ENCRYPTION_SECRET'
] as const;

const booleanSchema = z.enum(['true', 'false']);
const positiveIntegerSchema = z.coerce.number().int().positive();
const bodyLimitPattern = /^(\d+(?:\.\d+)?)(b|kb|mb)$/iu;
const minimumBodyLimitBytes = 1024;
const maximumBodyLimitBytes = 1024 * 1024;

function readBoolean(value: string | undefined, fallback: boolean, variableName: string): boolean {
	if (value === undefined) return fallback;

	const result = booleanSchema.safeParse(value.trim().toLowerCase());
	if (!result.success) {
		throw new Error(`${variableName} must be true or false.`);
	}
	return result.data === 'true';
}

function readPositiveInteger(
	value: string | undefined,
	fallback: number,
	variableName: string
): number {
	if (value === undefined) return fallback;

	const result = positiveIntegerSchema.safeParse(value);
	if (!result.success) {
		throw new Error(`${variableName} must be a positive integer.`);
	}
	return result.data;
}

function readTrustProxyHops(value: string | undefined): number | false {
	if (value === undefined) return false;
	return readPositiveInteger(value, 1, 'TRUST_PROXY_HOPS');
}

function readStringArray(value: string | undefined, fallback: string[]): string[] {
	if (!value) {
		return fallback;
	}

	return value
		.split(',')
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

function readLogLevel(value: string | undefined, fallback: LogLevel): LogLevel {
	const normalizedValue = value?.trim();
	if (!normalizedValue) return fallback;

	if (
		normalizedValue === 'debug' ||
		normalizedValue === 'info' ||
		normalizedValue === 'warn' ||
		normalizedValue === 'error' ||
		normalizedValue === 'fatal'
	) {
		return normalizedValue;
	}

	throw new Error('LOG_LEVEL must be one of debug, info, warn, error, or fatal.');
}

function readSameSite(
	value: string | undefined,
	fallback: 'lax' | 'strict' | 'none'
): 'lax' | 'strict' | 'none' {
	if (value === undefined) return fallback;

	const result = z.enum(['lax', 'strict', 'none']).safeParse(value);
	if (!result.success) {
		throw new Error('COOKIE_SAME_SITE must be one of lax, strict, or none.');
	}
	return result.data;
}

function isLocalHostname(hostname: string): boolean {
	return (
		hostname === 'localhost' ||
		hostname.endsWith('.localhost') ||
		hostname === '127.0.0.1' ||
		hostname === '::1'
	);
}

function isProductionHttpsUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return (
			url.protocol === 'https:' &&
			!url.username &&
			!url.password &&
			!url.search &&
			!url.hash &&
			!isLocalHostname(url.hostname)
		);
	} catch {
		return false;
	}
}

function isProductionHttpsOrigin(value: string): boolean {
	if (!isProductionHttpsUrl(value)) return false;

	return new URL(value).origin === value;
}

function isOtlpEndpoint(value: string): boolean {
	try {
		const url = new URL(value);
		return (
			(url.protocol === 'http:' || url.protocol === 'https:') &&
			!url.username &&
			!url.password &&
			!url.search &&
			!url.hash
		);
	} catch {
		return false;
	}
}

function isProductionRpId(value: string): boolean {
	try {
		const url = new URL(`https://${value}`);
		return url.hostname === value && url.origin === `https://${value}` && !isLocalHostname(value);
	} catch {
		return false;
	}
}

function usesVerifiedDatabaseTls(value: string): boolean {
	try {
		return new URL(value).searchParams.get('sslmode') === 'verify-full';
	} catch {
		return false;
	}
}

function isRpIdValidForOrigin(rpId: string, origin: string): boolean {
	const hostname = new URL(origin).hostname;
	return hostname === rpId || hostname.endsWith(`.${rpId}`);
}

function assertNumberInRange(
	value: number,
	minimum: number,
	maximum: number,
	variableName: string
): void {
	if (value < minimum || value > maximum) {
		throw new Error(`${variableName} must be between ${minimum} and ${maximum}.`);
	}
}

function validateProductionConfig(environment: NodeJS.ProcessEnv, config: AppConfig): void {
	const missingVariables = productionRequiredVariables.filter(
		(variableName) => !environment[variableName]?.trim()
	);
	if (missingVariables.length > 0) {
		throw new Error(`Production configuration is missing: ${missingVariables.join(', ')}.`);
	}

	const weakSecrets = productionSecretVariables.filter(
		(variableName) => (environment[variableName]?.length ?? 0) < 32
	);
	if (weakSecrets.length > 0) {
		throw new Error(
			`Production secrets must contain at least 32 characters: ${weakSecrets.join(', ')}.`
		);
	}

	const secretValues = productionSecretVariables.map((variableName) => environment[variableName]);
	if (new Set(secretValues).size !== secretValues.length) {
		throw new Error('Production auth and encryption secrets must be pairwise distinct.');
	}

	if (!config.cookieSecure) {
		throw new Error('COOKIE_SECURE must be true in production.');
	}

	if (!/^postgres(?:ql)?:\/\//u.test(config.databaseUrl)) {
		throw new Error('DATABASE_URL must use the postgres or postgresql protocol in production.');
	}
	if (!usesVerifiedDatabaseTls(config.databaseUrl)) {
		throw new Error('DATABASE_URL must use sslmode=verify-full in production.');
	}

	if (config.corsOrigins.length === 0 || !config.corsOrigins.every(isProductionHttpsOrigin)) {
		throw new Error('CORS_ORIGINS must contain only non-local HTTPS origins in production.');
	}

	if (!isProductionRpId(config.webauthnRpId)) {
		throw new Error('WEBAUTHN_RP_ID must be a non-local hostname in production.');
	}

	if (!isProductionHttpsOrigin(config.webauthnOrigin)) {
		throw new Error('WEBAUTHN_ORIGIN must be a non-local HTTPS URL in production.');
	}
	if (!isRpIdValidForOrigin(config.webauthnRpId, config.webauthnOrigin)) {
		throw new Error('WEBAUTHN_RP_ID must match WEBAUTHN_ORIGIN or one of its parent domains.');
	}
	if (!config.corsOrigins.includes(config.webauthnOrigin)) {
		throw new Error('WEBAUTHN_ORIGIN must be included in CORS_ORIGINS in production.');
	}

	if (!isProductionHttpsUrl(config.r2PublicBaseUrl)) {
		throw new Error('R2_PUBLIC_BASE_URL must be a non-local HTTPS URL in production.');
	}

	if (config.r2BucketName === config.r2UploadBucketName) {
		throw new Error('R2_UPLOAD_BUCKET_NAME must be separate from the public R2 bucket.');
	}

	if (config.trustProxyHops === false) {
		throw new Error('TRUST_PROXY_HOPS must be configured in production.');
	}
}

function isUrlOrigin(value: string): boolean {
	try {
		const url = new URL(value);
		return url.origin === value && !url.username && !url.password;
	} catch {
		return false;
	}
}

function validateConfig(config: AppConfig): void {
	if (config.port > 65_535) {
		throw new Error('PORT must be between 1 and 65535.');
	}
	const bodyLimitMatch = bodyLimitPattern.exec(config.bodyLimit);
	const bodyLimitMultiplier =
		bodyLimitMatch?.[2]?.toLowerCase() === 'mb'
			? 1024 * 1024
			: bodyLimitMatch?.[2]?.toLowerCase() === 'kb'
				? 1024
				: 1;
	const bodyLimitBytes = Number(bodyLimitMatch?.[1]) * bodyLimitMultiplier;
	if (
		!bodyLimitMatch ||
		!Number.isFinite(bodyLimitBytes) ||
		bodyLimitBytes < minimumBodyLimitBytes ||
		bodyLimitBytes > maximumBodyLimitBytes
	) {
		throw new Error('BODY_LIMIT must be between 1kb and 1mb.');
	}
	if (!/^postgres(?:ql)?:\/\//u.test(config.databaseUrl)) {
		throw new Error('DATABASE_URL must use the postgres or postgresql protocol.');
	}
	if (
		config.corsOrigins.length === 0 ||
		config.corsOrigins.length > 20 ||
		new Set(config.corsOrigins).size !== config.corsOrigins.length ||
		!config.corsOrigins.every(isUrlOrigin)
	) {
		throw new Error('CORS_ORIGINS must contain valid URL origins.');
	}
	if (
		!config.jwtIssuer.trim() ||
		!config.jwtAudience.trim() ||
		config.jwtIssuer.length > 200 ||
		config.jwtAudience.length > 200
	) {
		throw new Error('JWT_ISSUER and JWT_AUDIENCE must be non-empty.');
	}
	if (
		!config.r2AssetKeyPrefix ||
		config.r2AssetKeyPrefix !== config.r2AssetKeyPrefix.trim() ||
		config.r2AssetKeyPrefix.length > 256 ||
		config.r2AssetKeyPrefix.startsWith('/') ||
		config.r2AssetKeyPrefix.includes('..') ||
		config.r2AssetKeyPrefix.includes('\\') ||
		!/^[A-Za-z0-9][A-Za-z0-9/_-]*$/u.test(config.r2AssetKeyPrefix)
	) {
		throw new Error('R2_ASSET_KEY_PREFIX must be a relative object-key prefix.');
	}
	if (config.otelExporterOtlpEndpoint && !isOtlpEndpoint(config.otelExporterOtlpEndpoint)) {
		throw new Error(
			'OTEL_EXPORTER_OTLP_ENDPOINT must be an HTTP(S) URL without credentials, a query, or a fragment.'
		);
	}
	if (config.otelMetricExportIntervalMs < 1_000 || config.otelMetricExportIntervalMs > 300_000) {
		throw new Error('OTEL_METRIC_EXPORT_INTERVAL_MS must be between 1000 and 300000.');
	}
	if (config.otelServiceName.length > 100) {
		throw new Error('OTEL_SERVICE_NAME must contain at most 100 characters.');
	}

	assertNumberInRange(config.databaseMaxConnections, 1, 100, 'DATABASE_MAX_CONNECTIONS');
	if (config.trustProxyHops !== false) {
		assertNumberInRange(config.trustProxyHops, 1, 5, 'TRUST_PROXY_HOPS');
	}
	assertNumberInRange(config.accessTokenTtlSeconds, 60, 3_600, 'ACCESS_TOKEN_TTL_SECONDS');
	assertNumberInRange(config.refreshTokenTtlSeconds, 3_600, 2_592_000, 'REFRESH_TOKEN_TTL_SECONDS');
	assertNumberInRange(config.pendingTokenTtlSeconds, 60, 900, 'PENDING_TOKEN_TTL_SECONDS');
	assertNumberInRange(config.sessionTtlSeconds, 3_600, 2_592_000, 'SESSION_TTL_SECONDS');
	assertNumberInRange(
		config.sessionAbsoluteTtlSeconds,
		3_600,
		7_776_000,
		'SESSION_ABSOLUTE_TTL_SECONDS'
	);
	if (config.accessTokenTtlSeconds > config.refreshTokenTtlSeconds) {
		throw new Error('ACCESS_TOKEN_TTL_SECONDS must not exceed REFRESH_TOKEN_TTL_SECONDS.');
	}
	if (config.refreshTokenTtlSeconds > config.sessionAbsoluteTtlSeconds) {
		throw new Error('REFRESH_TOKEN_TTL_SECONDS must not exceed SESSION_ABSOLUTE_TTL_SECONDS.');
	}
	if (config.sessionTtlSeconds > config.sessionAbsoluteTtlSeconds) {
		throw new Error('SESSION_TTL_SECONDS must not exceed SESSION_ABSOLUTE_TTL_SECONDS.');
	}
	assertNumberInRange(config.rateLimitWindowMs, 1_000, 3_600_000, 'RATE_LIMIT_WINDOW_MS');
	assertNumberInRange(config.rateLimitMax, 1, 100_000, 'RATE_LIMIT_MAX');
	assertNumberInRange(config.authRateLimitMax, 1, 10_000, 'AUTH_RATE_LIMIT_MAX');
	if (config.authRateLimitMax > config.rateLimitMax) {
		throw new Error('AUTH_RATE_LIMIT_MAX must not exceed RATE_LIMIT_MAX.');
	}
	assertNumberInRange(config.r2UploadUrlTtlSeconds, 60, 3_600, 'R2_UPLOAD_URL_TTL_SECONDS');
	assertNumberInRange(config.storefrontCacheTtlSeconds, 1, 3_600, 'STOREFRONT_CACHE_TTL_SECONDS');
	assertNumberInRange(config.storefrontCacheMaxEntries, 1, 5_000, 'STOREFRONT_CACHE_MAX_ENTRIES');
}

export function readAppConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
	const nodeEnvResult = z
		.enum(['development', 'test', 'production'])
		.safeParse(environment['NODE_ENV'] ?? 'development');
	if (!nodeEnvResult.success) {
		throw new Error('NODE_ENV must be one of development, test, or production.');
	}
	const nodeEnv = nodeEnvResult.data;
	const cookieSecure = readBoolean(
		environment['COOKIE_SECURE'],
		nodeEnv === 'production',
		'COOKIE_SECURE'
	);
	const cookieSameSite = readSameSite(
		environment['COOKIE_SAME_SITE'],
		cookieSecure ? 'none' : 'lax'
	);
	if (cookieSameSite === 'none' && !cookieSecure) {
		throw new Error('COOKIE_SECURE must be true when COOKIE_SAME_SITE is none.');
	}

	const config: AppConfig = {
		nodeEnv,
		port: readPositiveInteger(environment['PORT'], 3000, 'PORT'),
		databaseUrl: environment['DATABASE_URL'] ?? fallbackDatabaseUrl,
		databaseMaxConnections: readPositiveInteger(
			environment['DATABASE_MAX_CONNECTIONS'],
			10,
			'DATABASE_MAX_CONNECTIONS'
		),
		trustProxyHops: readTrustProxyHops(environment['TRUST_PROXY_HOPS']),
		corsOrigins: readStringArray(environment['CORS_ORIGINS'], [
			'http://localhost:4173',
			'http://localhost:5173'
		]),
		bodyLimit: environment['BODY_LIMIT'] ?? '64kb',
		logLevel: readLogLevel(environment['LOG_LEVEL'], nodeEnv === 'production' ? 'info' : 'debug'),
		cookieSecure,
		cookieSameSite,
		accessTokenSecret: environment['ACCESS_TOKEN_SECRET'] ?? 'development-access-secret',
		refreshTokenSecret: environment['REFRESH_TOKEN_SECRET'] ?? 'development-refresh-secret',
		pendingTokenSecret: environment['PENDING_TOKEN_SECRET'] ?? 'development-pending-secret',
		dataEncryptionSecret:
			environment['DATA_ENCRYPTION_SECRET'] ??
			environment['ACCESS_TOKEN_SECRET'] ??
			'development-data-secret',
		jwtIssuer: environment['JWT_ISSUER'] ?? 'nrg-commerce-api',
		jwtAudience: environment['JWT_AUDIENCE'] ?? 'nrg-commerce-admin',
		accessTokenTtlSeconds: readPositiveInteger(
			environment['ACCESS_TOKEN_TTL_SECONDS'],
			900,
			'ACCESS_TOKEN_TTL_SECONDS'
		),
		refreshTokenTtlSeconds: readPositiveInteger(
			environment['REFRESH_TOKEN_TTL_SECONDS'],
			604_800,
			'REFRESH_TOKEN_TTL_SECONDS'
		),
		pendingTokenTtlSeconds: readPositiveInteger(
			environment['PENDING_TOKEN_TTL_SECONDS'],
			300,
			'PENDING_TOKEN_TTL_SECONDS'
		),
		sessionTtlSeconds: readPositiveInteger(
			environment['SESSION_TTL_SECONDS'],
			604_800,
			'SESSION_TTL_SECONDS'
		),
		sessionAbsoluteTtlSeconds: readPositiveInteger(
			environment['SESSION_ABSOLUTE_TTL_SECONDS'],
			2_592_000,
			'SESSION_ABSOLUTE_TTL_SECONDS'
		),
		totpIssuer: environment['TOTP_ISSUER'] ?? 'NRG Commerce',
		webauthnRpId: environment['WEBAUTHN_RP_ID'] ?? 'localhost',
		webauthnRpName: environment['WEBAUTHN_RP_NAME'] ?? 'NRG Commerce',
		webauthnOrigin: environment['WEBAUTHN_ORIGIN'] ?? 'http://localhost:4173',
		rateLimitWindowMs: readPositiveInteger(
			environment['RATE_LIMIT_WINDOW_MS'],
			60_000,
			'RATE_LIMIT_WINDOW_MS'
		),
		rateLimitMax: readPositiveInteger(environment['RATE_LIMIT_MAX'], 100, 'RATE_LIMIT_MAX'),
		authRateLimitMax: readPositiveInteger(
			environment['AUTH_RATE_LIMIT_MAX'],
			10,
			'AUTH_RATE_LIMIT_MAX'
		),
		r2AccountId: environment['R2_ACCOUNT_ID'] ?? 'development-account-id',
		r2BucketName: environment['R2_BUCKET_NAME'] ?? 'development-bucket',
		r2UploadBucketName: environment['R2_UPLOAD_BUCKET_NAME'] ?? 'development-upload-bucket',
		r2AccessKeyId: environment['R2_ACCESS_KEY_ID'] ?? 'development-access-key-id',
		r2SecretAccessKey: environment['R2_SECRET_ACCESS_KEY'] ?? 'development-secret-access-key',
		r2PublicBaseUrl: environment['R2_PUBLIC_BASE_URL'] ?? 'https://example.com/assets',
		r2AssetKeyPrefix: environment['R2_ASSET_KEY_PREFIX'] ?? 'products/skus',
		r2UploadUrlTtlSeconds: readPositiveInteger(
			environment['R2_UPLOAD_URL_TTL_SECONDS'],
			900,
			'R2_UPLOAD_URL_TTL_SECONDS'
		),
		storefrontCacheTtlSeconds: readPositiveInteger(
			environment['STOREFRONT_CACHE_TTL_SECONDS'],
			60,
			'STOREFRONT_CACHE_TTL_SECONDS'
		),
		storefrontCacheMaxEntries: readPositiveInteger(
			environment['STOREFRONT_CACHE_MAX_ENTRIES'],
			500,
			'STOREFRONT_CACHE_MAX_ENTRIES'
		),
		otelExporterOtlpEndpoint: environment['OTEL_EXPORTER_OTLP_ENDPOINT']?.trim() || null,
		otelServiceName: environment['OTEL_SERVICE_NAME']?.trim() || 'nrg-commerce-api',
		otelMetricExportIntervalMs: readPositiveInteger(
			environment['OTEL_METRIC_EXPORT_INTERVAL_MS'],
			60_000,
			'OTEL_METRIC_EXPORT_INTERVAL_MS'
		)
	};

	validateConfig(config);

	if (nodeEnv === 'production') validateProductionConfig(environment, config);

	return config;
}

export function deriveEncryptionKey(secret: string): Buffer {
	return createHash('sha256').update(secret).digest();
}
