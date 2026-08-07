import assert from 'node:assert/strict';
import test from 'node:test';

import {
	attributeMapSchema,
	booleanLikeSchema,
	dateSchema,
	isBoundedJsonValue,
	jsonValueSchema,
	moneySchema,
	resourceSlugSchema,
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

test('moneySchema rejects non-finite numbers without an explicit finite check', () => {
	assert.equal(moneySchema.safeParse(Number.POSITIVE_INFINITY).success, false);
	assert.equal(moneySchema.safeParse(Number.NEGATIVE_INFINITY).success, false);
	assert.equal(moneySchema.safeParse(Number.NaN).success, false);
});

test('resourceSlugSchema only accepts canonical internal route segments', () => {
	assert.equal(resourceSlugSchema.parse('glass-beaker-500'), 'glass-beaker-500');
	for (const unsafeSlug of [
		'//example.com',
		'../admin',
		'glass/beaker',
		'glass beaker',
		'Glass-Beaker',
		'glass--beaker'
	]) {
		assert.equal(resourceSlugSchema.safeParse(unsafeSlug).success, false, unsafeSlug);
	}
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

test('isBoundedJsonValue enforces node, depth, string, and key limits', () => {
	assert.equal(isBoundedJsonValue(Array.from({ length: 500 }, () => 0)), false);
	assert.equal(isBoundedJsonValue('x'.repeat(2_001)), false);
	assert.equal(isBoundedJsonValue({ ['x'.repeat(101)]: true }), false);

	let nestedValue: unknown = 'leaf';
	for (let depth = 0; depth < 9; depth += 1) nestedValue = [nestedValue];
	assert.equal(isBoundedJsonValue(nestedValue), false);
});

test('isBoundedJsonValue rejects non-finite values and unsupported objects', () => {
	for (const value of [Number.NaN, Number.POSITIVE_INFINITY, new Date(), () => true]) {
		assert.equal(isBoundedJsonValue(value), false);
	}

	const nullPrototype = Object.create(null) as Record<string, unknown>;
	nullPrototype['value'] = 'accepted';
	assert.equal(isBoundedJsonValue(nullPrototype), true);
});

test('isBoundedJsonValue rejects cycles, repeated references, and unsafe keys', () => {
	const cyclic: Record<string, unknown> = {};
	cyclic['self'] = cyclic;
	assert.equal(isBoundedJsonValue(cyclic), false);

	const shared = { value: true };
	assert.equal(isBoundedJsonValue({ first: shared, second: shared }), false);
	for (const key of ['__proto__', 'constructor', 'prototype']) {
		assert.equal(isBoundedJsonValue({ [key]: true }), false, key);
	}
});
