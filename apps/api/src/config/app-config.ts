import { createHash } from 'node:crypto';
import type { LogLevel } from '@packages/database';

export type AppConfig = {
	nodeEnv: string;
	port: number;
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
};

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
	return {
		nodeEnv,
		port: readNumber(environment['PORT'], 3000),
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
		r2UploadUrlTtlSeconds: readNumber(environment['R2_UPLOAD_URL_TTL_SECONDS'], 900)
	};
}

export function deriveEncryptionKey(secret: string): Buffer {
	return createHash('sha256').update(secret).digest();
}
