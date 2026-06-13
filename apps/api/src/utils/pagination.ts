type PaginationInput = {
	page: number;
	limit: number;
	total: number;
};

export function buildPagination(input: PaginationInput) {
	return {
		page: input.page,
		limit: input.limit,
		total: input.total,
		totalPages: Math.ceil(input.total / input.limit)
	};
}

export function buildPaginatedResponse<T>(data: T, input: PaginationInput) {
	return {
		data,
		pagination: buildPagination(input)
	};
}
