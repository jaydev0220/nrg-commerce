export type PaginationInput = { page: number; limit: number };

export function paginate<T>(data: T[], input: PaginationInput) {
	const total = data.length;
	const totalPages = total === 0 ? 0 : Math.ceil(total / input.limit);
	const start = (input.page - 1) * input.limit;
	return {
		data: data.slice(start, start + input.limit),
		pagination: { page: input.page, limit: input.limit, total, totalPages }
	};
}

export function compareValues(
	left: string | number | Date | null,
	right: string | number | Date | null,
	order: 'asc' | 'desc'
): number {
	const multiplier = order === 'asc' ? 1 : -1;
	if (left === right) return 0;
	if (left === null) return -1 * multiplier;
	if (right === null) return 1 * multiplier;
	const leftValue = left instanceof Date ? left.getTime() : left;
	const rightValue = right instanceof Date ? right.getTime() : right;
	return (leftValue < rightValue ? -1 : 1) * multiplier;
}
