import { z } from 'zod';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const maximumAttributeDepth = 8;
const maximumAttributeNodes = 500;
const maximumAttributeEntries = 100;
const maximumAttributeKeyLength = 100;
const maximumAttributeStringLength = 2_000;
const unsafeAttributeKeys = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;

	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function isBoundedJsonValue(value: unknown): value is JsonValue {
	try {
		const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
		let nodeCount = 0;

		while (stack.length > 0) {
			const current = stack.pop();
			if (!current) break;

			nodeCount += 1;
			if (nodeCount > maximumAttributeNodes || current.depth > maximumAttributeDepth) {
				return false;
			}

			if (current.value === null || typeof current.value === 'boolean') continue;
			if (typeof current.value === 'number') {
				if (!Number.isFinite(current.value)) return false;
				continue;
			}
			if (typeof current.value === 'string') {
				if (current.value.length > maximumAttributeStringLength) return false;
				continue;
			}

			if (Array.isArray(current.value)) {
				if (current.value.length > maximumAttributeEntries) return false;
				for (const item of current.value) {
					stack.push({ value: item, depth: current.depth + 1 });
				}
				continue;
			}

			if (!isPlainRecord(current.value)) return false;
			const entries = Object.entries(current.value);
			if (entries.length > maximumAttributeEntries) return false;
			for (const [key, entryValue] of entries) {
				if (
					key.length === 0 ||
					key.length > maximumAttributeKeyLength ||
					unsafeAttributeKeys.has(key)
				) {
					return false;
				}
				stack.push({ value: entryValue, depth: current.depth + 1 });
			}
		}

		return true;
	} catch {
		return false;
	}
}

function isBoundedAttributeMap(value: unknown): value is Record<string, JsonValue> {
	return isPlainRecord(value) && isBoundedJsonValue(value);
}

export const uuidSchema = z.uuid();
export const serializedDateSchema = z.iso.datetime({ offset: true });
export const dateSchema = z.union([
	z.date(),
	serializedDateSchema.transform((value) => new Date(value))
]);
export const sortOrderSchema = z.enum(['asc', 'desc']);
export const emailAddressSchema = z.email().max(254);
export const normalizedEmailAddressSchema = z
	.string()
	.trim()
	.toLowerCase()
	.pipe(emailAddressSchema);
export const searchQuerySchema = z.string().trim().min(1).max(200);
export const resourceSlugSchema = z.string().trim().min(1).max(160);
export const paginationQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20)
});
export const booleanLikeSchema = z.preprocess((value) => {
	if (typeof value !== 'string') {
		return value;
	}

	const normalizedValue = value.trim().toLowerCase();

	if (normalizedValue === 'true') {
		return true;
	}

	if (normalizedValue === 'false') {
		return false;
	}

	return value;
}, z.boolean());
export const moneySchema = z.coerce.number().finite().min(0).max(99_999_999.99).multipleOf(0.01);
export const jsonValueSchema = z.custom<JsonValue>(
	isBoundedJsonValue,
	'JSON data exceeds the supported structure or size limits.'
);
export const attributeMapSchema = z.custom<Record<string, JsonValue>>(
	isBoundedAttributeMap,
	'Attributes exceed the supported structure or size limits.'
);

export function nonEmptyUpdate<T extends z.ZodRawShape>(schema: z.ZodObject<T>): z.ZodObject<T> {
	return schema.refine(
		(value) => Object.values(value).some((fieldValue) => fieldValue !== undefined),
		'At least one field must be provided.'
	) as z.ZodObject<T>;
}
