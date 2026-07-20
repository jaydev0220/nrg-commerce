import { AppError } from '../../../errors/app-error.js';

import type { CatalogJsonValue, CatalogSkuRecord } from '../../../types/catalog.js';
import type { CatalogRepository } from '../catalog.repository.js';

type SkuServiceDependencies = {
	repository: Pick<
		CatalogRepository,
		| 'listSkus'
		| 'findSkuById'
		| 'findProductById'
		| 'createSku'
		| 'updateSku'
		| 'softDeleteSku'
		| 'forceDeleteSku'
		| 'skuCodeExists'
	>;
};

function ensureSku(sku: CatalogSkuRecord | null): CatalogSkuRecord {
	if (!sku) {
		throw new AppError(404, 'SKU_NOT_FOUND', 'The requested product SKU could not be found.');
	}

	return sku;
}

export function createSkuService(dependencies: SkuServiceDependencies) {
	return {
		listSkus(query: {
			page: number;
			limit: number;
			search?: string;
			published?: boolean;
			categoryId?: string;
			sort: 'createdAt' | 'updatedAt' | 'skuCode' | 'price';
			order: 'asc' | 'desc';
		}) {
			return dependencies.repository.listSkus(query, {
				includeImages: false
			});
		},

		async getSku(
			skuId: string,
			query: {
				includeImages: boolean;
			}
		): Promise<CatalogSkuRecord> {
			return ensureSku(
				await dependencies.repository.findSkuById(skuId, {
					includeImages: query.includeImages
				})
			);
		},

		async createSku(input: {
			productId: string;
			skuCode: string;
			price: number;
			stockQuantity: number;
			attributes: Record<string, CatalogJsonValue>;
		}): Promise<CatalogSkuRecord> {
			if (await dependencies.repository.skuCodeExists(input.skuCode)) {
				throw new AppError(409, 'SKU_CODE_CONFLICT', 'The provided SKU code is already in use.');
			}

			if (!(await dependencies.repository.findProductById(input.productId))) {
				throw new AppError(404, 'PRODUCT_NOT_FOUND', 'The referenced product could not be found.');
			}

			return dependencies.repository.createSku(input);
		},

		async updateSku(
			skuId: string,
			input: {
				productId?: string;
				skuCode?: string;
				price?: number;
				stockQuantity?: number;
				attributes?: Record<string, CatalogJsonValue>;
			}
		): Promise<CatalogSkuRecord> {
			const existingSku = ensureSku(
				await dependencies.repository.findSkuById(skuId, {
					includeImages: false
				})
			);

			if (input.skuCode && input.skuCode !== existingSku.skuCode) {
				if (await dependencies.repository.skuCodeExists(input.skuCode, skuId)) {
					throw new AppError(409, 'SKU_CODE_CONFLICT', 'The provided SKU code is already in use.');
				}
			}

			if (input.productId && !(await dependencies.repository.findProductById(input.productId))) {
				throw new AppError(404, 'PRODUCT_NOT_FOUND', 'The referenced product could not be found.');
			}

			return dependencies.repository.updateSku(skuId, input);
		},

		async deleteSku(
			skuId: string,
			input: {
				force: boolean;
			}
		): Promise<'soft' | 'force'> {
			const existingSku = ensureSku(
				await dependencies.repository.findSkuById(skuId, {
					includeImages: true
				})
			);

			if (input.force && existingSku.images.length > 0) {
				throw new AppError(
					409,
					'SKU_DELETE_CONFLICT',
					'Force deleting a product SKU with assigned images is not allowed.'
				);
			}

			if (input.force) {
				await dependencies.repository.forceDeleteSku(skuId);
				return 'force';
			}

			await dependencies.repository.softDeleteSku(skuId);
			return 'soft';
		}
	};
}

export type SkuService = ReturnType<typeof createSkuService>;
