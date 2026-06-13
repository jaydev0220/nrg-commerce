import argon2 from 'argon2';

import { verifyLegacyScryptHash } from './crypto.js';

const hashOptions = {
	type: argon2.argon2id,
	memoryCost: 19_456,
	timeCost: 2,
	parallelism: 1
} as const;

export function createPasswordHasher() {
	return {
		async hash(password: string): Promise<string> {
			return argon2.hash(password, hashOptions);
		},

		async verify(password: string, digest: string): Promise<boolean> {
			if (digest.startsWith('$argon2')) {
				return argon2.verify(digest, password);
			}

			return verifyLegacyScryptHash(password, digest);
		},

		needsRehash(digest: string): boolean {
			if (!digest.startsWith('$argon2')) {
				return true;
			}

			return argon2.needsRehash(digest, hashOptions);
		}
	};
}

export type PasswordHasher = ReturnType<typeof createPasswordHasher>;
