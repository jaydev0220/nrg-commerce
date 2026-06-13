import { AppError } from '../../errors/app-error.js';
import type { ImageObjectStorage } from '../../utils/object-storage.js';

import type { CatalogImageRecord } from '../../types/catalog.js';
import type { CatalogRepository } from './catalog.repository.js';

type ImageServiceDependencies = {
	repository: Pick<
		CatalogRepository,
		| 'findSkuById'
		| 'listImages'
		| 'findImageById'
		| 'createImage'
		| 'softDeleteImage'
		| 'forceDeleteImage'
	>;
	objectStorage: Pick<ImageObjectStorage, 'createImageUploadTarget' | 'assertImageAssetExists'>;
};

function ensureImage(image: CatalogImageRecord | null): CatalogImageRecord {
	if (!image) {
		throw new AppError(404, 'IMAGE_NOT_FOUND', 'The requested product image could not be found.');
	}

	return image;
}

export function createImageService(dependencies: ImageServiceDependencies) {
	async function ensureSkuExists(skuId: string): Promise<void> {
		const sku = await dependencies.repository.findSkuById(skuId, {
			includeImages: false
		});

		if (!sku) {
			throw new AppError(404, 'SKU_NOT_FOUND', 'The requested product SKU could not be found.');
		}
	}

	return {
		async listImages(
			skuId: string,
			query: {
				page: number;
				limit: number;
				type?: 'thumbnail' | 'gallery';
				sort: 'position' | 'createdAt' | 'updatedAt';
				order: 'asc' | 'desc';
			}
		) {
			await ensureSkuExists(skuId);
			return dependencies.repository.listImages(skuId, query);
		},

		async getImage(skuId: string, imageId: string): Promise<CatalogImageRecord> {
			await ensureSkuExists(skuId);
			return ensureImage(await dependencies.repository.findImageById(skuId, imageId));
		},

		async createImage(
			skuId: string,
			input: {
				assetKey: string;
				altText: string;
				type: 'thumbnail' | 'gallery';
				position: number;
			}
		): Promise<CatalogImageRecord> {
			await ensureSkuExists(skuId);
			const uploadedAsset = await dependencies.objectStorage.assertImageAssetExists(skuId, {
				assetKey: input.assetKey
			});
			return dependencies.repository.createImage(skuId, {
				imageUrl: uploadedAsset.imageUrl,
				assetKey: uploadedAsset.assetKey,
				altText: input.altText,
				type: input.type,
				position: input.position
			});
		},

		async createImageUploadTarget(
			skuId: string,
			input: {
				fileName: string;
				contentType: string;
			}
		) {
			await ensureSkuExists(skuId);
			return dependencies.objectStorage.createImageUploadTarget(skuId, input);
		},

		async deleteImage(
			skuId: string,
			imageId: string,
			input: {
				force: boolean;
				deleteAsset: boolean;
			}
		): Promise<{
			mode: 'soft' | 'force';
			assetDeleted: boolean;
		}> {
			await ensureSkuExists(skuId);
			const image = ensureImage(await dependencies.repository.findImageById(skuId, imageId));

			if (input.force) {
				await dependencies.repository.forceDeleteImage(image.id);
				return {
					mode: 'force',
					assetDeleted: false
				};
			}

			await dependencies.repository.softDeleteImage(image.id);
			return {
				mode: 'soft',
				assetDeleted: false
			};
		}
	};
}

export type ImageService = ReturnType<typeof createImageService>;
