import assert from 'node:assert/strict';
import test from 'node:test';

import type { DatabaseClient } from '@packages/database';

import { createPrismaCatalogRepository } from '../../../src/modules/management/catalog.repository.js';

test('deleteCategory fails closed when a reassignment target is no longer active', async () => {
	const sourceCategoryId = '0189076c-4f2a-7fe1-b9fd-2d68df455111';
	const targetCategoryId = '0189076c-4f2a-7fe1-b9fd-2d68df455222';
	const checkedCategoryIds: string[] = [];
	const transaction = {
		$queryRaw: async () => ['locked'],
		productCategory: {
			findFirst: async (input: { where: { id: string } }) => {
				checkedCategoryIds.push(input.where.id);
				return input.where.id === sourceCategoryId ? { parentId: null, position: 0 } : null;
			},
			findMany: async () => {
				throw new Error('delete should stop before loading category relations');
			}
		},
		product: {
			count: async () => {
				throw new Error('delete should stop before counting assigned products');
			}
		}
	};
	const database = {
		$transaction: async (operation: (client: typeof transaction) => Promise<unknown>) =>
			operation(transaction)
	} as unknown as DatabaseClient;
	const repository = createPrismaCatalogRepository(database);

	const result = await repository.deleteCategory(sourceCategoryId, {
		productDisposition: 'reassign',
		childDisposition: 'none',
		reassignToCategoryId: targetCategoryId
	});

	assert.equal(result, 'reassign_not_found');
	assert.deepEqual(checkedCategoryIds, [sourceCategoryId, targetCategoryId]);
});
