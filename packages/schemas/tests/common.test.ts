import assert from 'node:assert/strict';
import test from 'node:test';

import {
	attributeMapSchema,
	booleanLikeSchema,
	dateSchema,
	jsonValueSchema,
	serializedDateSchema
} from '../src/common.js';

test('parses serialized dates into Date instances for management responses', () => {
	const value = '2026-07-22T03:00:00.000Z';

	assert.equal(serializedDateSchema.parse(value), value);
	assert.deepEqual(dateSchema.parse(value), new Date(value));
	assert.deepEqual(dateSchema.parse(new Date(value)), new Date(value));
});

test('normalizes boolean query values and validates recursive JSON', () => {
	assert.equal(booleanLikeSchema.parse(' TRUE '), true);
	assert.equal(booleanLikeSchema.parse('false'), false);
	assert.equal(booleanLikeSchema.parse(true), true);
	assert.equal(booleanLikeSchema.safeParse('yes').success, false);
	assert.deepEqual(jsonValueSchema.parse({ list: [1, true, null, 'value'] }), {
		list: [1, true, null, 'value']
	});
});

test('attributeMapSchema rejects deeply nested values without overflowing the call stack', () => {
	let nestedValue: unknown = 'leaf';
	for (let depth = 0; depth < 5_000; depth += 1) {
		nestedValue = { child: nestedValue };
	}

	let result: ReturnType<typeof attributeMapSchema.safeParse> | undefined;
	assert.doesNotThrow(() => {
		result = attributeMapSchema.safeParse({ nested: nestedValue });
	});
	assert.equal(result?.success, false);
});

test('jsonValueSchema rejects deeply nested values without overflowing the call stack', () => {
	let nestedValue: unknown = 'leaf';
	for (let depth = 0; depth < 5_000; depth += 1) {
		nestedValue = [nestedValue];
	}

	let result: ReturnType<typeof jsonValueSchema.safeParse> | undefined;
	assert.doesNotThrow(() => {
		result = jsonValueSchema.safeParse(nestedValue);
	});
	assert.equal(result?.success, false);
});

test('attributeMapSchema rejects oversized maps and prototype-sensitive keys', () => {
	const oversizedMap = Object.fromEntries(
		Array.from({ length: 101 }, (_value, index) => [`key-${index}`, index])
	);

	assert.equal(attributeMapSchema.safeParse(oversizedMap).success, false);
	assert.equal(
		attributeMapSchema.safeParse(JSON.parse('{"__proto__":{"polluted":true}}')).success,
		false
	);
});
