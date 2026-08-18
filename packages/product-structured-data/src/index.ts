import { z } from 'zod';

const textSchema = z.string().trim().min(1).max(500);
const shortTextSchema = z.string().trim().min(1).max(200);
const finiteNumberSchema = z.number().finite();

export const structuredDataUnitValues = [
	{ value: 'ul', label: 'µL', unitCode: '4G' },
	{ value: 'ml', label: 'mL', unitCode: 'MLT' },
	{ value: 'l', label: 'L', unitCode: 'LTR' },
	{ value: 'mg', label: 'mg', unitCode: 'MGM' },
	{ value: 'g', label: 'g', unitCode: 'GRM' },
	{ value: 'kg', label: 'kg', unitCode: 'KGM' },
	{ value: 'mm', label: 'mm', unitCode: 'MMT' },
	{ value: 'cm', label: 'cm', unitCode: 'CMT' },
	{ value: 'm', label: 'm', unitCode: 'MTR' },
	{ value: 'in', label: 'in', unitCode: 'INH' },
	{ value: 'c', label: '°C', unitCode: 'CEL' },
	{ value: 'f', label: '°F', unitCode: 'FAH' }
] as const;

export type StructuredDataUnit = (typeof structuredDataUnitValues)[number];
export const structuredDataUnitCodes = structuredDataUnitValues.map((unit) => unit.unitCode) as [
	string,
	...string[]
];

const unitCodeSchema = z.enum(structuredDataUnitCodes);
const unitTextSchema = z.string().trim().min(1).max(20);

const measurementSchema = z
	.object({
		value: finiteNumberSchema.optional(),
		minValue: finiteNumberSchema.optional(),
		maxValue: finiteNumberSchema.optional(),
		unitCode: unitCodeSchema.optional(),
		unitText: unitTextSchema.optional()
	})
	.strict()
	.superRefine((measurement, context) => {
		const hasValue = measurement.value !== undefined;
		const hasRange = measurement.minValue !== undefined || measurement.maxValue !== undefined;
		if (hasValue === hasRange) {
			context.addIssue({
				code: 'custom',
				path: ['value'],
				message: 'A measurement must provide either value or minValue/maxValue.'
			});
		}
		if (hasRange && (measurement.minValue === undefined || measurement.maxValue === undefined)) {
			context.addIssue({
				code: 'custom',
				path: ['minValue'],
				message: 'Both minValue and maxValue are required for a range.'
			});
		}
		if (
			measurement.minValue !== undefined &&
			measurement.maxValue !== undefined &&
			measurement.minValue > measurement.maxValue
		) {
			context.addIssue({
				code: 'custom',
				path: ['minValue'],
				message: 'minValue must not exceed maxValue.'
			});
		}
		if (measurement.unitCode === undefined && measurement.unitText === undefined) {
			context.addIssue({
				code: 'custom',
				path: ['unitCode'],
				message: 'A controlled unit is required.'
			});
		}
	});

export type StructuredMeasurement = z.output<typeof measurementSchema>;

const gtinSchema = z
	.string()
	.trim()
	.regex(/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/, {
		error: 'GTIN must contain 8, 12, 13, or 14 digits.'
	})
	.refine(isValidGtin, { error: 'GTIN checksum is invalid.' });

const customPropertySchema = z.object({
	name: z.string().trim().min(1).max(100),
	value: textSchema
});

const structuredFieldsShape = {
	color: shortTextSchema.optional(),
	size: textSchema.optional(),
	material: shortTextSchema.optional(),
	pattern: shortTextSchema.optional(),
	suggestedAge: shortTextSchema.optional(),
	suggestedGender: shortTextSchema.optional(),
	gtin: gtinSchema.optional(),
	mpn: shortTextSchema.optional(),
	model: shortTextSchema.optional(),
	weight: measurementSchema.optional(),
	width: measurementSchema.optional(),
	height: measurementSchema.optional(),
	depth: measurementSchema.optional(),
	countryOfOrigin: z.string().trim().min(2).max(100).optional(),
	capacity: measurementSchema.optional(),
	graduation: measurementSchema.optional(),
	outerDiameter: measurementSchema.optional(),
	innerDiameter: measurementSchema.optional(),
	wallThickness: measurementSchema.optional(),
	jointSize: measurementSchema.optional(),
	threadSize: measurementSchema.optional(),
	temperatureRange: measurementSchema.optional(),
	autoclavable: z.boolean().optional(),
	sterility: z.enum(['sterile', 'non-sterile', 'aseptic']).optional(),
	calibration: shortTextSchema.optional(),
	coating: shortTextSchema.optional(),
	additionalProperties: z.array(customPropertySchema).max(25).optional()
};

export const structuredFieldsSchema = z
	.object(structuredFieldsShape)
	.strict()
	.superRefine((fields, context) => {
		const properties = fields.additionalProperties ?? [];
		const names = properties.map((property) => property.name.toLowerCase());
		if (new Set(names).size !== names.length) {
			context.addIssue({
				code: 'custom',
				path: ['additionalProperties'],
				message: 'Custom property names must be unique.'
			});
		}
	});

export type StructuredFields = z.output<typeof structuredFieldsSchema>;

export type StructuredFieldPreset = {
	key: keyof Omit<StructuredFields, 'additionalProperties'> | 'custom';
	label: string;
	group: 'variant' | 'identifier' | 'physical' | 'laboratory';
	kind: 'text' | 'identifier' | 'measurement' | 'boolean' | 'enum' | 'country';
};

export const structuredFieldPresets: readonly StructuredFieldPreset[] = [
	{ key: 'color', label: 'Color', group: 'variant', kind: 'text' },
	{ key: 'size', label: 'Size', group: 'variant', kind: 'text' },
	{ key: 'material', label: 'Material', group: 'variant', kind: 'text' },
	{ key: 'pattern', label: 'Pattern', group: 'variant', kind: 'text' },
	{ key: 'suggestedAge', label: 'Suggested age', group: 'variant', kind: 'text' },
	{ key: 'suggestedGender', label: 'Suggested gender', group: 'variant', kind: 'text' },
	{ key: 'gtin', label: 'GTIN', group: 'identifier', kind: 'identifier' },
	{ key: 'mpn', label: 'MPN', group: 'identifier', kind: 'text' },
	{ key: 'model', label: 'Model', group: 'identifier', kind: 'text' },
	{ key: 'countryOfOrigin', label: 'Country of origin', group: 'identifier', kind: 'country' },
	{ key: 'weight', label: 'Weight', group: 'physical', kind: 'measurement' },
	{ key: 'width', label: 'Width', group: 'physical', kind: 'measurement' },
	{ key: 'height', label: 'Height', group: 'physical', kind: 'measurement' },
	{ key: 'depth', label: 'Depth', group: 'physical', kind: 'measurement' },
	{ key: 'capacity', label: 'Capacity', group: 'laboratory', kind: 'measurement' },
	{ key: 'graduation', label: 'Graduation interval', group: 'laboratory', kind: 'measurement' },
	{ key: 'outerDiameter', label: 'Outer diameter', group: 'laboratory', kind: 'measurement' },
	{ key: 'innerDiameter', label: 'Inner diameter', group: 'laboratory', kind: 'measurement' },
	{ key: 'wallThickness', label: 'Wall thickness', group: 'laboratory', kind: 'measurement' },
	{ key: 'jointSize', label: 'Joint size', group: 'laboratory', kind: 'measurement' },
	{ key: 'threadSize', label: 'Thread size', group: 'laboratory', kind: 'measurement' },
	{ key: 'temperatureRange', label: 'Temperature range', group: 'laboratory', kind: 'measurement' },
	{ key: 'autoclavable', label: 'Autoclavable', group: 'laboratory', kind: 'boolean' },
	{ key: 'sterility', label: 'Sterility', group: 'laboratory', kind: 'enum' },
	{ key: 'calibration', label: 'Calibration class', group: 'laboratory', kind: 'text' },
	{ key: 'coating', label: 'Coating', group: 'laboratory', kind: 'text' },
	{ key: 'custom', label: 'Custom property', group: 'laboratory', kind: 'text' }
] as const;

export type StructuredDataQuantitativeValue = {
	'@type': 'QuantitativeValue';
	value?: number;
	minValue?: number;
	maxValue?: number;
	unitCode?: string;
	unitText?: string;
};

export type StructuredDataPropertyValue = {
	'@type': 'PropertyValue';
	name: string;
	value: string | number | StructuredDataQuantitativeValue;
};

export type StructuredDataPeopleAudience = {
	'@type': 'PeopleAudience';
	suggestedAge?: string;
	suggestedGender?: string;
};

export type StructuredDataFragment = {
	color?: string;
	size?: string;
	material?: string;
	pattern?: string;
	audience?: StructuredDataPeopleAudience;
	gtin8?: string;
	gtin12?: string;
	gtin13?: string;
	gtin14?: string;
	mpn?: string;
	model?: string;
	weight?: StructuredDataQuantitativeValue;
	width?: StructuredDataQuantitativeValue;
	height?: StructuredDataQuantitativeValue;
	depth?: StructuredDataQuantitativeValue;
	countryOfOrigin?: string;
	additionalProperty?: StructuredDataPropertyValue[];
};

export type StructuredDataDiagnostic = {
	code: 'stored-structured-fields-invalid' | 'fragment-invalid';
	severity: 'error';
};

export type StructuredDataGenerationResult = {
	fragment: StructuredDataFragment;
	diagnostics: StructuredDataDiagnostic[];
};

const quantitativeValueSchema = z
	.object({
		'@type': z.literal('QuantitativeValue'),
		value: finiteNumberSchema.optional(),
		minValue: finiteNumberSchema.optional(),
		maxValue: finiteNumberSchema.optional(),
		unitCode: z.string().min(1).max(20).optional(),
		unitText: unitTextSchema.optional()
	})
	.strict()
	.superRefine((value, context) => {
		if (
			value.value === undefined &&
			(value.minValue === undefined || value.maxValue === undefined)
		) {
			context.addIssue({ code: 'custom', message: 'QuantitativeValue is incomplete.' });
		}
		if (
			value.value !== undefined &&
			(value.minValue !== undefined || value.maxValue !== undefined)
		) {
			context.addIssue({
				code: 'custom',
				message: 'QuantitativeValue cannot mix value and range.'
			});
		}
		if (
			value.minValue !== undefined &&
			value.maxValue !== undefined &&
			value.minValue > value.maxValue
		) {
			context.addIssue({ code: 'custom', message: 'QuantitativeValue range is invalid.' });
		}
	});

const propertyValueSchema = z.object({
	'@type': z.literal('PropertyValue'),
	name: z.string().trim().min(1).max(100),
	value: z.union([textSchema, finiteNumberSchema, quantitativeValueSchema])
});

export const structuredDataFragmentSchema = z
	.object({
		color: shortTextSchema.optional(),
		size: textSchema.optional(),
		material: shortTextSchema.optional(),
		pattern: shortTextSchema.optional(),
		audience: z
			.object({
				'@type': z.literal('PeopleAudience'),
				suggestedAge: shortTextSchema.optional(),
				suggestedGender: shortTextSchema.optional()
			})
			.strict()
			.optional(),
		gtin8: z
			.string()
			.regex(/^\d{8}$/)
			.optional(),
		gtin12: z
			.string()
			.regex(/^\d{12}$/)
			.optional(),
		gtin13: z
			.string()
			.regex(/^\d{13}$/)
			.optional(),
		gtin14: z
			.string()
			.regex(/^\d{14}$/)
			.optional(),
		mpn: shortTextSchema.optional(),
		model: shortTextSchema.optional(),
		weight: quantitativeValueSchema.optional(),
		width: quantitativeValueSchema.optional(),
		height: quantitativeValueSchema.optional(),
		depth: quantitativeValueSchema.optional(),
		countryOfOrigin: z.string().trim().min(2).max(100).optional(),
		additionalProperty: z.array(propertyValueSchema).max(50).optional()
	})
	.strict();

const measurementKeys = new Set([
	'weight',
	'width',
	'height',
	'depth',
	'capacity',
	'graduation',
	'outerdiameter',
	'innerdiameter',
	'wallthickness',
	'jointsize',
	'threadsize',
	'temperaturerange',
	'volume',
	'diameter',
	'length'
]);

const nativeTextKeys = new Set([
	'color',
	'size',
	'material',
	'pattern',
	'suggestedage',
	'suggestedgender',
	'mpn',
	'model',
	'countryoforigin'
]);

const recognizedAttributeKeys = new Set([
	...nativeTextKeys,
	'gtin',
	'autoclavable',
	'sterility',
	'calibration',
	'coating',
	...measurementKeys
]);

const explicitPropertyNames: Record<string, string> = {
	capacity: 'capacity',
	graduation: 'graduation interval',
	outerdiameter: 'outer diameter',
	innerdiameter: 'inner diameter',
	wallthickness: 'wall thickness',
	jointsize: 'joint size',
	threadsize: 'thread size',
	temperaturerange: 'temperature range',
	calibration: 'calibration class',
	coating: 'coating',
	sterility: 'sterility',
	autoclavable: 'autoclavable'
};

const presetKeySet = new Set(Object.keys(structuredFieldsShape));

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function scalarText(value: unknown): string | null {
	if (typeof value === 'string') return value.trim() || null;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	return null;
}

function normalizedKey(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[\s_-]+/g, '');
}

function isValidGtin(value: string): boolean {
	const digits = value.split('').map(Number);
	const checkDigit = digits.pop();
	if (checkDigit === undefined) return false;
	let sum = 0;
	for (let index = digits.length - 1; index >= 0; index -= 1) {
		sum += (digits.length - index) % 2 === 1 ? (digits[index] ?? 0) * 3 : (digits[index] ?? 0);
	}
	return (10 - (sum % 10)) % 10 === checkDigit;
}

function gtinOutputKey(
	value: string
): keyof Pick<StructuredDataFragment, 'gtin8' | 'gtin12' | 'gtin13' | 'gtin14'> {
	return `gtin${value.length}` as keyof Pick<
		StructuredDataFragment,
		'gtin8' | 'gtin12' | 'gtin13' | 'gtin14'
	>;
}

function unitForText(value: string): StructuredDataUnit | null {
	const normalized = value.trim().toLowerCase().replace('μ', 'µ');
	return (
		structuredDataUnitValues.find(
			(unit) => unit.value === normalized || unit.label.toLowerCase() === normalized
		) ?? null
	);
}

function quantityFromMeasurement(
	measurement: StructuredMeasurement
): StructuredDataQuantitativeValue {
	return {
		'@type': 'QuantitativeValue',
		...(measurement.value !== undefined ? { value: measurement.value } : {}),
		...(measurement.minValue !== undefined ? { minValue: measurement.minValue } : {}),
		...(measurement.maxValue !== undefined ? { maxValue: measurement.maxValue } : {}),
		...(measurement.unitCode ? { unitCode: measurement.unitCode } : {}),
		...(measurement.unitText ? { unitText: measurement.unitText } : {})
	};
}

function parseMeasurement(value: unknown): StructuredDataQuantitativeValue | string | null {
	if (isPlainRecord(value)) {
		const parsed = measurementSchema.safeParse(value);
		return parsed.success ? quantityFromMeasurement(parsed.data) : null;
	}
	const text = scalarText(value);
	if (!text) return null;
	const rangeMatch = text.match(/^(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)\s*([^\d\s]+)$/);
	const singleMatch = text.match(/^(-?\d+(?:\.\d+)?)\s*([^\d\s]+)$/);
	const match = rangeMatch ?? singleMatch;
	if (!match) return text;
	const unit = unitForText((rangeMatch ? match[3] : match[2]) ?? '');
	if (!unit) return text;
	if (rangeMatch) {
		return {
			'@type': 'QuantitativeValue',
			minValue: Number(match[1]),
			maxValue: Number(match[2]),
			unitCode: unit.unitCode,
			unitText: unit.label
		};
	}
	return {
		'@type': 'QuantitativeValue',
		value: Number(match[1]),
		unitCode: unit.unitCode,
		unitText: unit.label
	};
}

function addProperty(
	properties: Map<string, StructuredDataPropertyValue>,
	property: StructuredDataPropertyValue
) {
	properties.set(property.name.trim().toLowerCase(), property);
}

function attributeFragment(attributes: unknown): {
	fragment: StructuredDataFragment;
	properties: Map<string, StructuredDataPropertyValue>;
} {
	const fragment: StructuredDataFragment = {};
	const properties = new Map<string, StructuredDataPropertyValue>();
	if (!isPlainRecord(attributes)) return { fragment, properties };

	for (const [rawKey, rawValue] of Object.entries(attributes)) {
		const rawName = rawKey.trim();
		if (!rawName) continue;
		const key = normalizedKey(rawKey);
		if (measurementKeys.has(key)) {
			const parsed = parseMeasurement(rawValue);
			if (parsed === null) continue;
			addProperty(properties, {
				'@type': 'PropertyValue',
				name: explicitPropertyNames[key] ?? rawName,
				value: parsed
			});
			continue;
		}
		const text = scalarText(rawValue);
		if (!text) continue;
		if (key === 'gtin' && /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(text) && isValidGtin(text)) {
			fragment[gtinOutputKey(text)] = text;
			continue;
		}
		if (nativeTextKeys.has(key)) {
			const field = {
				color: 'color',
				size: 'size',
				material: 'material',
				pattern: 'pattern',
				suggestedage: 'suggestedAge',
				suggestedgender: 'suggestedGender',
				mpn: 'mpn',
				model: 'model',
				countryoforigin: 'countryOfOrigin'
			}[key];
			if (key === 'suggestedage' || key === 'suggestedgender') {
				const audience = fragment.audience ?? { '@type': 'PeopleAudience' as const };
				const audienceField = key === 'suggestedage' ? 'suggestedAge' : 'suggestedGender';
				fragment.audience = { ...audience, [audienceField]: text };
			} else {
				(fragment as Record<string, unknown>)[field ?? key] = text;
			}
			continue;
		}
		if (key === 'autoclavable' && ['true', 'yes'].includes(text.toLowerCase())) {
			addProperty(properties, {
				'@type': 'PropertyValue',
				name: 'autoclavable',
				value: 'true'
			});
			continue;
		}
		if (key === 'sterility' || key === 'calibration' || key === 'coating') {
			addProperty(properties, {
				'@type': 'PropertyValue',
				name: explicitPropertyNames[key] ?? rawName,
				value: text
			});
			continue;
		}
		if (!recognizedAttributeKeys.has(key)) {
			addProperty(properties, { '@type': 'PropertyValue', name: rawName, value: text });
		}
	}

	return { fragment, properties };
}

function mergeExplicitFields(
	fragment: StructuredDataFragment,
	properties: Map<string, StructuredDataPropertyValue>,
	fields: StructuredFields
) {
	const textFields = [
		'color',
		'size',
		'material',
		'pattern',
		'mpn',
		'model',
		'countryOfOrigin'
	] as const;
	for (const field of textFields) {
		if (fields[field] !== undefined) fragment[field] = fields[field];
	}
	if (fields.suggestedAge !== undefined || fields.suggestedGender !== undefined) {
		fragment.audience = {
			'@type': 'PeopleAudience',
			...(fields.suggestedAge !== undefined ? { suggestedAge: fields.suggestedAge } : {}),
			...(fields.suggestedGender !== undefined ? { suggestedGender: fields.suggestedGender } : {})
		};
	}
	if (fields.gtin !== undefined) fragment[gtinOutputKey(fields.gtin)] = fields.gtin;
	for (const field of ['weight', 'width', 'height', 'depth'] as const) {
		if (fields[field] !== undefined) fragment[field] = quantityFromMeasurement(fields[field]);
	}
	for (const field of [
		'capacity',
		'graduation',
		'outerDiameter',
		'innerDiameter',
		'wallThickness',
		'jointSize',
		'threadSize',
		'temperatureRange'
	] as const) {
		if (fields[field] !== undefined) {
			addProperty(properties, {
				'@type': 'PropertyValue',
				name: explicitPropertyNames[normalizedKey(field)] ?? field,
				value: quantityFromMeasurement(fields[field])
			});
		}
	}
	if (fields.autoclavable !== undefined) {
		addProperty(properties, {
			'@type': 'PropertyValue',
			name: 'autoclavable',
			value: String(fields.autoclavable)
		});
	}
	if (fields.sterility !== undefined) {
		addProperty(properties, {
			'@type': 'PropertyValue',
			name: 'sterility',
			value: fields.sterility
		});
	}
	for (const field of ['calibration', 'coating'] as const) {
		if (fields[field] !== undefined) {
			addProperty(properties, {
				'@type': 'PropertyValue',
				name: explicitPropertyNames[field] ?? field,
				value: fields[field]
			});
		}
	}
	for (const property of fields.additionalProperties ?? []) {
		addProperty(properties, {
			'@type': 'PropertyValue',
			name: property.name,
			value: property.value
		});
	}
}

function stripEmptyFragment(fragment: StructuredDataFragment): StructuredDataFragment {
	const result = Object.fromEntries(
		Object.entries(fragment).filter(([, value]) => {
			if (value === undefined || value === null) return false;
			if (typeof value === 'object' && !Array.isArray(value)) return Object.keys(value).length > 1;
			return true;
		})
	) as StructuredDataFragment;
	return result;
}

export function generateStructuredData(input: {
	attributes: unknown;
	structuredFields: unknown;
}): StructuredDataGenerationResult {
	const diagnostics: StructuredDataDiagnostic[] = [];
	const parsedFields = structuredFieldsSchema.safeParse(
		input.structuredFields === undefined ? {} : input.structuredFields
	);
	const fields = parsedFields.success ? parsedFields.data : ({} as StructuredFields);
	if (!parsedFields.success)
		diagnostics.push({ code: 'stored-structured-fields-invalid', severity: 'error' });

	const { fragment, properties } = attributeFragment(input.attributes);
	mergeExplicitFields(fragment, properties, fields);
	const normalizedFragment = stripEmptyFragment({
		...fragment,
		...(properties.size > 0
			? {
					additionalProperty: [...properties.values()].sort((left, right) =>
						left.name.toLowerCase() < right.name.toLowerCase()
							? -1
							: left.name.toLowerCase() > right.name.toLowerCase()
								? 1
								: 0
					)
				}
			: {})
	});
	const parsedFragment = structuredDataFragmentSchema.safeParse(normalizedFragment);
	if (!parsedFragment.success) {
		diagnostics.push({ code: 'fragment-invalid', severity: 'error' });
		return { fragment: {}, diagnostics };
	}
	return { fragment: parsedFragment.data, diagnostics };
}

export function structuredFieldPreset(key: string): StructuredFieldPreset | undefined {
	return structuredFieldPresets.find((preset) => preset.key === key);
}

export function isStructuredFieldKey(
	value: string
): value is keyof Omit<StructuredFields, 'additionalProperties'> {
	return presetKeySet.has(value) && value !== 'additionalProperties';
}

export function controlledUnitForCode(code: string): StructuredDataUnit | undefined {
	return structuredDataUnitValues.find((unit) => unit.unitCode === code);
}
