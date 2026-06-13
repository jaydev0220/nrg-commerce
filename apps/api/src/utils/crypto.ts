import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
	scryptSync,
	timingSafeEqual
} from 'node:crypto';

export function hashRefreshToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function createDataCipher(secret: string) {
	const key = createHash('sha256').update(secret).digest();

	return {
		encrypt(value: string): string {
			const iv = randomBytes(12);
			const cipher = createCipheriv('aes-256-gcm', key, iv);
			const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
			const authTag = cipher.getAuthTag();

			return [
				'v1',
				iv.toString('base64url'),
				authTag.toString('base64url'),
				encrypted.toString('base64url')
			].join('.');
		},

		decrypt(value: string): string {
			const [version, iv, authTag, encrypted] = value.split('.');

			if (version !== 'v1' || !iv || !authTag || !encrypted) {
				throw new Error('Invalid encrypted payload.');
			}

			const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
			decipher.setAuthTag(Buffer.from(authTag, 'base64url'));

			return Buffer.concat([
				decipher.update(Buffer.from(encrypted, 'base64url')),
				decipher.final()
			]).toString('utf8');
		}
	};
}

export function verifyLegacyScryptHash(password: string, digest: string): boolean {
	if (!digest.startsWith('scrypt$')) {
		return false;
	}

	const [, n, r, p, salt, hash] = digest.split('$');

	if (!n || !r || !p || !salt || !hash) {
		return false;
	}

	const expectedHash = Buffer.from(hash, 'hex');
	const actualHash = scryptSync(password, salt, expectedHash.length, {
		N: Number(n),
		r: Number(r),
		p: Number(p)
	});

	return expectedHash.length === actualHash.length && timingSafeEqual(expectedHash, actualHash);
}
