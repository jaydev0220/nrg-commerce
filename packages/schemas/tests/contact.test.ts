import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { contactRequestSchema, inquiryRequestSchema } from '../src/contact.js';

const validBaseRequest = {
	turnstileToken: 'verified-token',
	name: 'Ada Lovelace',
	email: 'ada@example.com',
	message: 'Please send specifications.'
};

describe('contact request schemas', () => {
	test('normalizes optional contact fields without changing required content', () => {
		const result = contactRequestSchema.parse({
			...validBaseRequest,
			company: '  Analytical Engines  ',
			phone: '   ',
			inquiryType: '',
			productInterest: '  Hydrometers '
		});

		assert.deepEqual(result, {
			...validBaseRequest,
			company: 'Analytical Engines',
			phone: undefined,
			inquiryType: undefined,
			productInterest: 'Hydrometers'
		});
	});

	test('accepts an inquiry SKU while rejecting fields from the other request kind', () => {
		assert.deepEqual(inquiryRequestSchema.parse({ ...validBaseRequest, skuCode: ' SKU-100 ' }), {
			...validBaseRequest,
			skuCode: 'SKU-100'
		});
		assert.equal(
			inquiryRequestSchema.safeParse({ ...validBaseRequest, inquiryType: 'Sales' }).success,
			false
		);
		assert.equal(
			contactRequestSchema.safeParse({ ...validBaseRequest, skuCode: 'SKU-100' }).success,
			false
		);
	});

	test('rejects invalid identities, missing messages, and oversized verification tokens', () => {
		assert.equal(
			contactRequestSchema.safeParse({ ...validBaseRequest, email: 'invalid' }).success,
			false
		);
		assert.equal(
			contactRequestSchema.safeParse({ ...validBaseRequest, message: '   ' }).success,
			false
		);
		assert.equal(
			contactRequestSchema.safeParse({
				...validBaseRequest,
				turnstileToken: 'x'.repeat(2049)
			}).success,
			false
		);
	});
});
