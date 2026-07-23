import { generateSecret, generateURI, verify } from 'otplib';

import { createDataCipher } from './crypto.js';

type TotpServiceConfig = {
	issuer: string;
	encryptionSecret: string;
};

const digits = 6;
const period = 30;

export function createTotpService(config: TotpServiceConfig) {
	const cipher = createDataCipher(config.encryptionSecret);

	async function verifyCodeWithTimeStep(
		secret: string,
		code: string,
		currentDigits = digits,
		currentPeriod = period,
		afterTimeStep?: bigint | null
	) {
		const minimumTimeStep =
			afterTimeStep === undefined || afterTimeStep === null ? undefined : Number(afterTimeStep);
		if (minimumTimeStep !== undefined && !Number.isSafeInteger(minimumTimeStep)) {
			throw new Error('The stored TOTP time step is outside the supported range.');
		}
		const result = await verify({
			secret,
			token: code,
			digits: currentDigits,
			period: currentPeriod,
			...(minimumTimeStep === undefined ? {} : { afterTimeStep: minimumTimeStep })
		});

		if (!result.valid) return { valid: false } as const;
		if (
			!('timeStep' in result) ||
			typeof result.timeStep !== 'number' ||
			!Number.isSafeInteger(result.timeStep)
		) {
			throw new Error('TOTP verification did not return a valid time step.');
		}

		return { valid: true, timeStep: BigInt(result.timeStep) } as const;
	}

	return {
		async createSetup(label: string) {
			const secret = generateSecret();
			const otpauthUrl = generateURI({
				issuer: config.issuer,
				label,
				secret,
				digits,
				period
			});

			return {
				secret,
				digits,
				period,
				otpauthUrl
			};
		},

		async verifyCode(secret: string, code: string, currentDigits = digits, currentPeriod = period) {
			return (await verifyCodeWithTimeStep(secret, code, currentDigits, currentPeriod)).valid;
		},

		verifyCodeWithTimeStep,

		encryptSecret(secret: string): string {
			return cipher.encrypt(secret);
		},

		decryptSecret(secret: string): string {
			return cipher.decrypt(secret);
		}
	};
}

export type TotpService = ReturnType<typeof createTotpService>;
