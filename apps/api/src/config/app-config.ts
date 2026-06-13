import { createHash } from 'node:crypto';

export type AppConfig = {
	nodeEnv: string;
	port: number;
	trustProxy: boolean;
	corsOrigins: string[];
	bodyLimit: string;
	accessTokenSecret: string;
	refreshTokenSecret: string;
	pendingTokenSecret: string;
	dataEncryptionSecret: string;
	accessTokenTtlSeconds: number;
	refreshTokenTtlSeconds: number;
	pendingTokenTtlSeconds: number;
	sessionTtlSeconds: number;
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

export function readAppConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
	return {
		nodeEnv: environment['NODE_ENV'] ?? 'development',
		port: readNumber(environment['PORT'], 3000),
		trustProxy: readBoolean(environment['TRUST_PROXY'], false),
		corsOrigins: readStringArray(environment['CORS_ORIGINS'], ['http://localhost:4173']),
		bodyLimit: environment['BODY_LIMIT'] ?? '64kb',
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
