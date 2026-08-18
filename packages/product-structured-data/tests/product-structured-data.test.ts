import assert from 'node:assert/strict';
import test from 'node:test';

import {
	controlledUnitForCode,
	generateStructuredData,
	isStructuredFieldKey,
	structuredDataFragmentSchema,
	structuredFieldsSchema,
	structuredFieldPreset,
	structuredFieldPresets
} from '../src/index.js';

test('normalizes literal size and lab measurements from attributes', () => {
	const result = generateStructuredData({
		attributes: { Size: 'medium', volume: '100 ml', material: 'glass' },
		structuredFields: {}
	});

	assert.equal(result.fragment.size, 'medium');
	assert.equal(result.fragment.material, 'glass');
	assert.deepEqual(result.fragment.additionalProperty?.[0]?.value, {
		'@type': 'QuantitativeValue',
		value: 100,
		unitCode: 'MLT',
		unitText: 'mL'
	});
});

test('explicit fields override attributes and custom properties are bounded', () => {
	const result = generateStructuredData({
		attributes: { color: 'blue', volume: '100 ml', extra: 'attribute' },
		structuredFields: {
			color: 'red',
			additionalProperties: [
				{ name: 'volume', value: '250 mL' },
				{ name: 'extra', value: 'explicit' }
			]
		}
	});

	assert.equal(result.fragment.color, 'red');
	assert.deepEqual(
		result.fragment.additionalProperty?.map((property) => [property.name, property.value]),
		[
			['extra', 'explicit'],
			['volume', '250 mL']
		]
	);
});

test('invalid stored fields are omitted while attribute metadata remains available', () => {
	const result = generateStructuredData({
		attributes: { color: 'blue' },
		structuredFields: { color: 'red', invalid: true }
	});

	assert.equal(result.fragment.color, 'blue');
	assert.equal(result.diagnostics[0]?.code, 'stored-structured-fields-invalid');
});

test('structured field schema rejects duplicate custom names and reversed ranges', () => {
	assert.equal(
		structuredFieldsSchema.safeParse({
			additionalProperties: [
				{ name: 'Voltage', value: '1' },
				{ name: 'voltage', value: '2' }
			]
		}).success,
		false
	);
	assert.equal(
		structuredFieldsSchema.safeParse({
			temperatureRange: { minValue: 20, maxValue: 10, unitCode: 'CEL' }
		}).success,
		false
	);
});

test('preset registry exposes focused lab and general metadata controls', () => {
	assert.ok(structuredFieldPresets.some((preset) => preset.key === 'capacity'));
	assert.ok(structuredFieldPresets.some((preset) => preset.key === 'gtin'));
	assert.ok(structuredFieldPresets.some((preset) => preset.key === 'custom'));
	assert.equal(structuredFieldPreset('capacity')?.kind, 'measurement');
	assert.equal(structuredFieldPreset('missing'), undefined);
	assert.equal(isStructuredFieldKey('color'), true);
	assert.equal(isStructuredFieldKey('additionalProperties'), false);
	assert.equal(controlledUnitForCode('MLT')?.label, 'mL');
	assert.equal(controlledUnitForCode('unknown'), undefined);
});

test('emits every explicit preset type with specific Schema.org properties first', () => {
	const result = generateStructuredData({
		attributes: {},
		structuredFields: {
			color: 'red',
			size: 'M',
			material: 'glass',
			pattern: 'plain',
			suggestedAge: 'adult',
			suggestedGender: 'unisex',
			gtin: '96385074',
			mpn: 'MPN-1',
			model: 'MODEL-1',
			weight: { value: 1, unitCode: 'KGM' },
			width: { value: 2, unitCode: 'CMT' },
			height: { value: 3, unitCode: 'MMT' },
			depth: { value: 4, unitCode: 'INH' },
			countryOfOrigin: 'TW',
			capacity: { minValue: 1, maxValue: 2, unitCode: 'MLT' },
			graduation: { value: 0.5, unitCode: 'MLT' },
			outerDiameter: { value: 10, unitCode: 'MMT' },
			innerDiameter: { value: 8, unitCode: 'MMT' },
			wallThickness: { value: 1, unitCode: 'MMT' },
			jointSize: { value: 24, unitCode: 'MMT' },
			threadSize: { value: 12, unitCode: 'MMT' },
			temperatureRange: { minValue: -20, maxValue: 120, unitCode: 'CEL' },
			autoclavable: true,
			sterility: 'sterile',
			calibration: 'Class A',
			coating: 'PTFE',
			additionalProperties: [{ name: 'Voltage', value: '24 V' }]
		}
	});

	assert.deepEqual(result.diagnostics, []);
	assert.equal(result.fragment.color, 'red');
	assert.deepEqual(result.fragment.audience, {
		'@type': 'PeopleAudience',
		suggestedAge: 'adult',
		suggestedGender: 'unisex'
	});
	assert.equal(result.fragment.gtin8, '96385074');
	assert.deepEqual(result.fragment.weight, {
		'@type': 'QuantitativeValue',
		value: 1,
		unitCode: 'KGM'
	});
	assert.deepEqual(result.fragment.additionalProperty, [
		{ '@type': 'PropertyValue', name: 'autoclavable', value: 'true' },
		{
			'@type': 'PropertyValue',
			name: 'calibration class',
			value: 'Class A'
		},
		{
			'@type': 'PropertyValue',
			name: 'capacity',
			value: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'MLT' }
		},
		{ '@type': 'PropertyValue', name: 'coating', value: 'PTFE' },
		{
			'@type': 'PropertyValue',
			name: 'graduation interval',
			value: { '@type': 'QuantitativeValue', value: 0.5, unitCode: 'MLT' }
		},
		{
			'@type': 'PropertyValue',
			name: 'inner diameter',
			value: { '@type': 'QuantitativeValue', value: 8, unitCode: 'MMT' }
		},
		{
			'@type': 'PropertyValue',
			name: 'joint size',
			value: { '@type': 'QuantitativeValue', value: 24, unitCode: 'MMT' }
		},
		{
			'@type': 'PropertyValue',
			name: 'outer diameter',
			value: { '@type': 'QuantitativeValue', value: 10, unitCode: 'MMT' }
		},
		{ '@type': 'PropertyValue', name: 'sterility', value: 'sterile' },
		{
			'@type': 'PropertyValue',
			name: 'temperature range',
			value: { '@type': 'QuantitativeValue', minValue: -20, maxValue: 120, unitCode: 'CEL' }
		},
		{
			'@type': 'PropertyValue',
			name: 'thread size',
			value: { '@type': 'QuantitativeValue', value: 12, unitCode: 'MMT' }
		},
		{
			'@type': 'PropertyValue',
			name: 'Voltage',
			value: '24 V'
		},
		{
			'@type': 'PropertyValue',
			name: 'wall thickness',
			value: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MMT' }
		}
	]);
});

test('normalizes scalar, range, and object attribute metadata case-insensitively', () => {
	const result = generateStructuredData({
		attributes: {
			COLOR: 'blue',
			'suggested age': 'adult',
			suggested_gender: 'female',
			GTIN: '96385074',
			MPN: 'MPN-2',
			Model: 'MODEL-2',
			country_of_origin: 'TW',
			weight: { value: 2, unitCode: 'KGM' },
			diameter: '75 mm',
			volume: '1–2 mL',
			'micro volume': '2 μL',
			autoclavable: 'yes',
			sterility: 'sterile',
			calibration: 'Class B',
			coating: 'silicone',
			custom: 42,
			blank: '   ',
			complex: { nested: true },
			invalidRange: { minValue: 2, unitCode: 'MLT' }
		},
		structuredFields: {}
	});

	assert.equal(result.fragment.color, 'blue');
	assert.deepEqual(result.fragment.audience, {
		'@type': 'PeopleAudience',
		suggestedAge: 'adult',
		suggestedGender: 'female'
	});
	assert.equal(result.fragment.gtin8, '96385074');
	assert.deepEqual(
		result.fragment.additionalProperty?.map((property) => [property.name, property.value]),
		[
			['autoclavable', 'true'],
			['calibration class', 'Class B'],
			['coating', 'silicone'],
			['custom', '42'],
			['diameter', { '@type': 'QuantitativeValue', value: 75, unitCode: 'MMT', unitText: 'mm' }],
			['micro volume', '2 μL'],
			['sterility', 'sterile'],
			[
				'volume',
				{ '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'MLT', unitText: 'mL' }
			],
			['weight', { '@type': 'QuantitativeValue', value: 2, unitCode: 'KGM' }]
		]
	);
});

test('rejects malformed measurements and invalid identifiers without throwing', () => {
	const nullFields = generateStructuredData({
		attributes: { color: 'blue' },
		structuredFields: null
	});
	assert.equal(nullFields.fragment.color, 'blue');
	assert.equal(nullFields.diagnostics[0]?.code, 'stored-structured-fields-invalid');
	assert.equal(structuredFieldsSchema.safeParse({ weight: { unitCode: 'KGM' } }).success, false);
	assert.equal(
		structuredFieldsSchema.safeParse({
			weight: { value: 1, minValue: 0, maxValue: 2, unitCode: 'KGM' }
		}).success,
		false
	);
	assert.equal(structuredFieldsSchema.safeParse({ gtin: '96385075' }).success, false);
	assert.equal(structuredFieldsSchema.safeParse({ gtin: '123' }).success, false);

	assert.equal(
		structuredDataFragmentSchema.safeParse({
			weight: { '@type': 'QuantitativeValue', unitCode: 'KGM' }
		}).success,
		false
	);
	assert.equal(
		structuredDataFragmentSchema.safeParse({
			weight: { '@type': 'QuantitativeValue', value: 1, minValue: 0, maxValue: 2, unitCode: 'KGM' }
		}).success,
		false
	);
	assert.equal(
		structuredDataFragmentSchema.safeParse({
			weight: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 1, unitCode: 'KGM' }
		}).success,
		false
	);

	const fallback = generateStructuredData({
		attributes: Object.fromEntries(
			Array.from({ length: 51 }, (_, index) => [`property-${index}`, String(index)])
		),
		structuredFields: {}
	});
	assert.deepEqual(fallback.fragment, {});
	assert.equal(fallback.diagnostics.at(-1)?.code, 'fragment-invalid');
});
