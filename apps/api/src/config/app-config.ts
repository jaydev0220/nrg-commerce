import { createHash } from 'node:crypto';
import type { LogLevel } from '@packages/database';

export type AppConfig = {
	nodeEnv: string;
	port: number;
	databaseUrl: string;
	databaseMaxConnections: number;
	trustProxy: boolean;
	corsOrigins: string[];
	bodyLimit: string;
	logLevel: LogLevel;
	cookieSecure: boolean;
	cookieSameSite: 'lax' | 'strict' | 'none';
	accessTokenSecret: string;
	refreshTokenSecret: string;
	pendingTokenSecret: string;
	dataEncryptionSecret: string;
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
	r2AccessKeyId: string;
	r2SecretAccessKey: string;
	r2PublicBaseUrl: string;
	r2AssetKeyPrefix: string;
	r2UploadUrlTtlSeconds: number;
	storefrontCacheTtlSeconds: number;
	storefrontCacheMaxEntries: number;
};

const fallbackDatabaseUrl = 'postgresql://postgres:postgres@localhost:5432/nrg_commerce';
const productionRequiredVariables = [
	'DATABASE_URL',
	'CORS_ORIGINS',
	'ACCESS_TOKEN_SECRET',
	'REFRESH_TOKEN_SECRET',
	'PENDING_TOKEN_SECRET',
	'DATA_ENCRYPTION_SECRET',
	'WEBAUTHN_RP_ID',
	'WEBAUTHN_RP_NAME',
	'WEBAUTHN_ORIGIN',
	'R2_ACCOUNT_ID',
	'R2_BUCKET_NAME',
	'R2_ACCESS_KEY_ID',
	'R2_SECRET_ACCESS_KEY',
	'R2_PUBLIC_BASE_URL'
] as const;

const productionSecretVariables = [
	'ACCESS_TOKEN_SECRET',
	'REFRESH_TOKEN_SECRET',
	'PENDING_TOKEN_SECRET',
	'DATA_ENCRYPTION_SECRET'
] as const;

function readBoolean(value: string | undefined, fallback: boolean): boolean {
	if (value === undefined) {
		return fallback;
	}

	return value.trim().toLowerCase() === 'true';
}

function readNumber(value: string | undefined, fallback: number): number {
	if (!value) {
		return fallback;
	}

	const parsedValue = Number(value);

	return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
	const parsedValue = readNumber(value, fallback);
	return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

function readConfiguredPositiveInteger(
	value: string | undefined,
	fallback: number,
	variableName: string
): number {
	if (value === undefined) return fallback;

	const parsedValue = Number(value);
	if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
		throw new Error(`${variableName} must be a positive integer.`);
	}

	return parsedValue;
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
	if (value === 'lax' || value === 'strict' || value === 'none') return value;
	return fallback;
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
			url.protocol === 'https:' && !url.username && !url.password && !isLocalHostname(url.hostname)
		);
	} catch {
		return false;
	}
}

function isProductionHttpsOrigin(value: string): boolean {
	if (!isProductionHttpsUrl(value)) return false;

	return new URL(value).origin === value;
}

function isProductionRpId(value: string): boolean {
	try {
		const url = new URL(`https://${value}`);
		return url.hostname === value && url.origin === `https://${value}` && !isLocalHostname(value);
	} catch {
		return false;
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

	if (config.corsOrigins.length === 0 || !config.corsOrigins.every(isProductionHttpsOrigin)) {
		throw new Error('CORS_ORIGINS must contain only non-local HTTPS origins in production.');
	}

	if (!isProductionRpId(config.webauthnRpId)) {
		throw new Error('WEBAUTHN_RP_ID must be a non-local hostname in production.');
	}

	if (!isProductionHttpsOrigin(config.webauthnOrigin)) {
		throw new Error('WEBAUTHN_ORIGIN must be a non-local HTTPS URL in production.');
	}

	if (!isProductionHttpsUrl(config.r2PublicBaseUrl)) {
		throw new Error('R2_PUBLIC_BASE_URL must be a non-local HTTPS URL in production.');
	}
}

export function readAppConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
	const nodeEnv = environment['NODE_ENV'] ?? 'development';
	const cookieSecure = readBoolean(environment['COOKIE_SECURE'], nodeEnv === 'production');
	const cookieSameSite = readSameSite(
		environment['COOKIE_SAME_SITE'],
		cookieSecure ? 'none' : 'lax'
	);
	if (cookieSameSite === 'none' && !cookieSecure) {
		throw new Error('COOKIE_SECURE must be true when COOKIE_SAME_SITE is none.');
	}
	const config: AppConfig = {
		nodeEnv,
		port: readNumber(environment['PORT'], 3000),
		databaseUrl: environment['DATABASE_URL'] ?? fallbackDatabaseUrl,
		databaseMaxConnections: readConfiguredPositiveInteger(
			environment['DATABASE_MAX_CONNECTIONS'],
			10,
			'DATABASE_MAX_CONNECTIONS'
		),
		trustProxy: readBoolean(environment['TRUST_PROXY'], false),
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
		accessTokenTtlSeconds: readNumber(environment['ACCESS_TOKEN_TTL_SECONDS'], 900),
		refreshTokenTtlSeconds: readNumber(environment['REFRESH_TOKEN_TTL_SECONDS'], 604_800),
		pendingTokenTtlSeconds: readNumber(environment['PENDING_TOKEN_TTL_SECONDS'], 300),
		sessionTtlSeconds: readNumber(environment['SESSION_TTL_SECONDS'], 604_800),
		sessionAbsoluteTtlSeconds: readNumber(environment['SESSION_ABSOLUTE_TTL_SECONDS'], 2_592_000),
		totpIssuer: environment['TOTP_ISSUER'] ?? 'NRG Commerce',
		webauthnRpId: environment['WEBAUTHN_RP_ID'] ?? 'localhost',
		webauthnRpName: environment['WEBAUTHN_RP_NAME'] ?? 'NRG Commerce',
		webauthnOrigin: environment['WEBAUTHN_ORIGIN'] ?? 'http://localhost:4173',
		rateLimitWindowMs: readNumber(environment['RATE_LIMIT_WINDOW_MS'], 60_000),
		rateLimitMax: readNumber(environment['RATE_LIMIT_MAX'], 100),
		authRateLimitMax: readNumber(environment['AUTH_RATE_LIMIT_MAX'], 10),
		r2AccountId: environment['R2_ACCOUNT_ID'] ?? 'development-account-id',
		r2BucketName: environment['R2_BUCKET_NAME'] ?? 'development-bucket',
		r2AccessKeyId: environment['R2_ACCESS_KEY_ID'] ?? 'development-access-key-id',
		r2SecretAccessKey: environment['R2_SECRET_ACCESS_KEY'] ?? 'development-secret-access-key',
		r2PublicBaseUrl: environment['R2_PUBLIC_BASE_URL'] ?? 'https://example.com/assets',
		r2AssetKeyPrefix: environment['R2_ASSET_KEY_PREFIX'] ?? 'products/skus',
		r2UploadUrlTtlSeconds: readNumber(environment['R2_UPLOAD_URL_TTL_SECONDS'], 900),
		storefrontCacheTtlSeconds: readPositiveInteger(environment['STOREFRONT_CACHE_TTL_SECONDS'], 60),
		storefrontCacheMaxEntries: readPositiveInteger(environment['STOREFRONT_CACHE_MAX_ENTRIES'], 500)
	};

	if (nodeEnv === 'production') validateProductionConfig(environment, config);

	return config;
}

export function deriveEncryptionKey(secret: string): Buffer {
	return createHash('sha256').update(secret).digest();
}
