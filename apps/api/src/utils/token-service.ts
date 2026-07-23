import { SignJWT, jwtVerify } from 'jose';

import { accessTokenClaimsSchema, refreshTokenClaimsSchema } from '@packages/schemas';
import type { MfaMethod } from '@packages/database';

import type {
	AccessTokenPayload,
	CeremonyTokenPurpose,
	PendingAuthPayload,
	RefreshTokenPayload
} from '../types/auth.js';

type TokenServiceConfig = {
	accessTokenSecret: string;
	refreshTokenSecret: string;
	pendingTokenSecret: string;
	issuer: string;
	audience: string;
	accessTokenTtlSeconds: number;
	refreshTokenTtlSeconds: number;
	pendingTokenTtlSeconds: number;
};

type PendingTokenClaims = PendingAuthPayload & {
	type: 'pending_auth';
};

type CeremonyTokenClaims = {
	type: 'ceremony';
	purpose: CeremonyTokenPurpose;
	[key: string]: unknown;
};

const algorithm = 'HS256';

function createSecretKey(secret: string): Uint8Array {
	return new TextEncoder().encode(secret);
}

async function issueToken(
	secret: Uint8Array,
	payload: Record<string, unknown>,
	ttlSeconds: number,
	issuer: string,
	audience: string
): Promise<string> {
	return new SignJWT(payload)
		.setProtectedHeader({ alg: algorithm })
		.setIssuer(issuer)
		.setAudience(audience)
		.setIssuedAt()
		.setExpirationTime(`${ttlSeconds}s`)
		.sign(secret);
}

export function createTokenService(config: TokenServiceConfig) {
	const accessTokenSecret = createSecretKey(config.accessTokenSecret);
	const refreshTokenSecret = createSecretKey(config.refreshTokenSecret);
	const pendingTokenSecret = createSecretKey(config.pendingTokenSecret);

	return {
		async issueAccessToken(payload: AccessTokenPayload): Promise<string> {
			return issueToken(
				accessTokenSecret,
				{
					...payload,
					type: 'access'
				},
				config.accessTokenTtlSeconds,
				config.issuer,
				config.audience
			);
		},

		async verifyAccessToken(token: string) {
			const { payload } = await jwtVerify(token, accessTokenSecret, {
				algorithms: [algorithm],
				issuer: config.issuer,
				audience: config.audience
			});
			return accessTokenClaimsSchema.parse(payload);
		},

		async issueRefreshToken(payload: RefreshTokenPayload): Promise<string> {
			return issueToken(
				refreshTokenSecret,
				{
					...payload,
					type: 'refresh'
				},
				config.refreshTokenTtlSeconds,
				config.issuer,
				config.audience
			);
		},

		async verifyRefreshToken(token: string) {
			const { payload } = await jwtVerify(token, refreshTokenSecret, {
				algorithms: [algorithm],
				issuer: config.issuer,
				audience: config.audience
			});
			return refreshTokenClaimsSchema.parse(payload);
		},

		async issuePendingAuthToken(payload: PendingAuthPayload): Promise<string> {
			return issueToken(
				pendingTokenSecret,
				{
					...payload,
					type: 'pending_auth'
				},
				config.pendingTokenTtlSeconds,
				config.issuer,
				config.audience
			);
		},

		async verifyPendingAuthToken(token: string): Promise<PendingTokenClaims> {
			const { payload } = await jwtVerify(token, pendingTokenSecret, {
				algorithms: [algorithm],
				issuer: config.issuer,
				audience: config.audience
			});

			if (payload['type'] !== 'pending_auth') {
				throw new Error('Invalid pending token type.');
			}

			const availableMfaMethods: MfaMethod[] = Array.isArray(payload['availableMfaMethods'])
				? payload['availableMfaMethods'].filter(
						(method): method is 'authenticator' | 'passkey' =>
							method === 'authenticator' || method === 'passkey'
					)
				: payload['requiredMfaMethod'] === 'passkey'
					? ['passkey']
					: ['authenticator'];
			const preferredMfaMethod =
				payload['preferredMfaMethod'] === 'passkey' && availableMfaMethods.includes('passkey')
					? 'passkey'
					: 'authenticator';

			return {
				type: 'pending_auth',
				staffId: String(payload['staffId']),
				primaryFactor: payload['primaryFactor'] === 'passkey' ? 'passkey' : 'password',
				preferredMfaMethod,
				availableMfaMethods
			};
		},

		async issueCeremonyToken(payload: CeremonyTokenClaims): Promise<string> {
			return issueToken(
				pendingTokenSecret,
				payload,
				config.pendingTokenTtlSeconds,
				config.issuer,
				config.audience
			);
		},

		async verifyCeremonyToken<T>(token: string, purpose: CeremonyTokenPurpose): Promise<T> {
			const { payload } = await jwtVerify(token, pendingTokenSecret, {
				algorithms: [algorithm],
				issuer: config.issuer,
				audience: config.audience
			});

			if (payload['type'] !== 'ceremony' || payload['purpose'] !== purpose) {
				throw new Error('Invalid ceremony token.');
			}

			return payload as T;
		}
	};
}

export type TokenService = ReturnType<typeof createTokenService>;
