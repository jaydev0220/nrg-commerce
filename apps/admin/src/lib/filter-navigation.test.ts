import { describe, expect, it } from 'vitest';

import { buildFilterQuery } from './filter-navigation';

describe('buildFilterQuery', () => {
	it('keeps selected values, trims text, and omits empty fields', () => {
		expect(
			buildFilterQuery([
				['search', '  northwind  '],
				['status', 'completed'],
				['empty', '   ']
			])
		).toBe('search=northwind&status=completed');
	});
});
