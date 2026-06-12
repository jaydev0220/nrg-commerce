import { z } from 'zod';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const uuidSchema = z.uuid();
export const dateSchema = z.date();
export const sortOrderSchema = z.enum(['asc', 'desc']);
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
export const moneySchema = z.coerce.number().finite().min(0);
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
	z.union([
		z.string(),
		z.number().finite(),
		z.boolean(),
		z.null(),
		z.array(jsonValueSchema),
		z.record(z.string(), jsonValueSchema)
	])
);
export const attributeMapSchema = z.record(z.string().min(1), jsonValueSchema);

export function nonEmptyUpdate<T extends z.ZodRawShape>(schema: z.ZodObject<T>): z.ZodObject<T> {
	return schema.refine(
		(value) => Object.values(value).some((fieldValue) => fieldValue !== undefined),
		'At least one field must be provided.'
	) as z.ZodObject<T>;
}
