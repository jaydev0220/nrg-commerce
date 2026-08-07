import { z } from 'zod';

export type JsonValue =
	string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type JsonValueLimits = {
	maximumDepth: number;
	maximumNodes?: number;
	maximumEntries: number;
	maximumKeyLength: number;
	maximumStringLength: number;
};

export const attributeJsonLimits = {
	maximumDepth: 8,
	maximumNodes: 500,
	maximumEntries: 100,
	maximumKeyLength: 100,
	maximumStringLength: 2_000
} as const satisfies JsonValueLimits;

const unsafeAttributeKeys = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;

	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

type JsonTraversalNode = { value: unknown; depth: number };

function validateJsonPrimitive(value: unknown, limits: JsonValueLimits): boolean | undefined {
	if (value === null || typeof value === 'boolean') return true;
	if (typeof value === 'number') return Number.isFinite(value);
	if (typeof value === 'string') return value.length <= limits.maximumStringLength;
	if (typeof value !== 'object') return false;
	return undefined;
}

function pushJsonChildren(
	node: JsonTraversalNode,
	stack: JsonTraversalNode[],
	seen: WeakSet<object>,
	limits: JsonValueLimits
): boolean {
	if (seen.has(node.value as object)) return false;
	seen.add(node.value as object);

	if (Array.isArray(node.value)) {
		if (node.value.length > limits.maximumEntries) return false;
		for (const item of node.value) {
			stack.push({ value: item, depth: node.depth + 1 });
		}
		return true;
	}

	if (!isPlainRecord(node.value)) return false;
	const entries = Object.entries(node.value);
	if (entries.length > limits.maximumEntries) return false;
	for (const [key, entryValue] of entries) {
		if (key.length === 0 || key.length > limits.maximumKeyLength || unsafeAttributeKeys.has(key)) {
			return false;
		}
		stack.push({ value: entryValue, depth: node.depth + 1 });
	}
	return true;
}

function exceedsJsonLimits(
	node: JsonTraversalNode,
	nodeCount: number,
	limits: JsonValueLimits
): boolean {
	return (
		(limits.maximumNodes !== undefined && nodeCount > limits.maximumNodes) ||
		node.depth > limits.maximumDepth
	);
}

function visitJsonNode(
	node: JsonTraversalNode,
	stack: JsonTraversalNode[],
	seen: WeakSet<object>,
	limits: JsonValueLimits
): boolean {
	const primitiveResult = validateJsonPrimitive(node.value, limits);
	return primitiveResult ?? pushJsonChildren(node, stack, seen, limits);
}

export function isBoundedJsonValue(
	value: unknown,
	limits: JsonValueLimits = attributeJsonLimits
): value is JsonValue {
	try {
		const stack: JsonTraversalNode[] = [{ value, depth: 0 }];
		const seen = new WeakSet<object>();
		let nodeCount = 0;

		while (stack.length > 0) {
			const current = stack.pop();
			if (!current) break;

			nodeCount += 1;
			if (exceedsJsonLimits(current, nodeCount, limits)) return false;
			if (!visitJsonNode(current, stack, seen, limits)) return false;
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
export const resourceSlugSchema = z
	.string()
	.trim()
	.min(1)
	.max(160)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
		error: 'Slug must use lowercase letters, numbers, and hyphens.'
	});
export const paginationQuerySchema = z.object({
	page: z.coerce.number().pipe(z.int().min(1)).default(1),
	limit: z.coerce.number().pipe(z.int().min(1).max(100)).default(20)
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
export const moneySchema = z.coerce.number().min(0).max(99_999_999.99).multipleOf(0.01);
export const jsonValueSchema = z.custom<JsonValue>(isBoundedJsonValue, {
	error: 'JSON data exceeds the supported structure or size limits.'
});
export const attributeMapSchema = z.custom<Record<string, JsonValue>>(isBoundedAttributeMap, {
	error: 'Attributes exceed the supported structure or size limits.'
});

export function nonEmptyUpdate<T extends z.ZodRawShape>(schema: z.ZodObject<T>): z.ZodObject<T> {
	return schema.refine(
		(value) => Object.values(value).some((fieldValue) => fieldValue !== undefined),
		{ error: 'At least one field must be provided.' }
	) as z.ZodObject<T>;
}
