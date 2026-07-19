import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { generate } from 'otplib';

import { createTotpService } from '../../src/utils/totp-service.js';

describe('TOTP service', () => {
	test('creates standards-based setup data and verifies the generated code', async () => {
		const service = createTotpService({
			issuer: 'NRG Commerce',
			encryptionSecret: 'test-encryption-secret'
		});
		const setup = await service.createSetup('ada@example.com');
		const token = await generate({
			secret: setup.secret,
			digits: setup.digits,
			period: setup.period
		});
		const invalidToken = `${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`;

		assert.equal(setup.digits, 6);
		assert.equal(setup.period, 30);
		assert.match(setup.otpauthUrl, /^otpauth:\/\/totp\//);
		assert.match(setup.otpauthUrl, /issuer=NRG(?:%20|\+)Commerce/);
		assert.equal(await service.verifyCode(setup.secret, token), true);
		assert.equal(await service.verifyCode(setup.secret, invalidToken), false);
	});

	test('round-trips encrypted TOTP secrets and rejects tampering', () => {
		const service = createTotpService({
			issuer: 'NRG Commerce',
			encryptionSecret: 'test-encryption-secret'
		});
		const encrypted = service.encryptSecret('base32-secret');

		assert.equal(service.decryptSecret(encrypted), 'base32-secret');
		assert.throws(() => service.decryptSecret(`${encrypted}tampered`));
	});
});
