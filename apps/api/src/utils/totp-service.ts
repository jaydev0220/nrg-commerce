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
			const result = await verify({
				secret,
				token: code,
				digits: currentDigits,
				period: currentPeriod
			});

			return result.valid;
		},

		encryptSecret(secret: string): string {
			return cipher.encrypt(secret);
		},

		decryptSecret(secret: string): string {
			return cipher.decrypt(secret);
		}
	};
}

export type TotpService = ReturnType<typeof createTotpService>;
