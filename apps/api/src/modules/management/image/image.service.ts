import { AppError } from '../../../errors/app-error.js';
import type { ImageObjectStorage } from '../../../utils/object-storage.js';

import type { CatalogImageRecord } from '../../../types/catalog.js';
import type { CatalogRepository } from '../catalog.repository.js';

type ImageServiceDependencies = {
	repository: Pick<
		CatalogRepository,
		| 'findProductById'
		| 'findSkuById'
		| 'listImages'
		| 'findImageById'
		| 'createImageUpload'
		| 'findImageUpload'
		| 'consumeImageUpload'
		| 'updateImageCrop'
		| 'softDeleteImage'
		| 'forceDeleteImage'
		| 'restoreImage'
		| 'listExpiredImages'
		| 'listExpiredImageUploads'
		| 'deleteImageUpload'
	>;
	objectStorage: Pick<
		ImageObjectStorage,
		'createImageUploadTarget' | 'promoteImageAsset' | 'deleteImageAsset' | 'deleteImageUploadAsset'
	>;
};

function ensureImage(image: CatalogImageRecord | null): CatalogImageRecord {
	if (!image) {
		throw new AppError(404, 'IMAGE_NOT_FOUND', 'The requested product image could not be found.');
	}

	return image;
}

export function createImageService(dependencies: ImageServiceDependencies) {
	async function ensureProductExists(productId: string): Promise<void> {
		const product = await dependencies.repository.findProductById(productId, {
			includeSkus: false,
			includeImages: false
		});
		if (!product) {
			throw new AppError(404, 'PRODUCT_NOT_FOUND', 'The requested product could not be found.');
		}
	}

	async function ensureSkuBelongsToProduct(productId: string, skuId: string): Promise<void> {
		const sku = await dependencies.repository.findSkuById(skuId, {
			includeImages: false
		});

		if (!sku || sku.productId !== productId) {
			throw new AppError(404, 'SKU_NOT_FOUND', 'The requested product SKU could not be found.');
		}
	}

	return {
		async listImages(
			productId: string,
			query: {
				page: number;
				limit: number;
				placement?: 'thumbnail' | 'shared-gallery' | 'sku-gallery';
				state: 'active' | 'deleted';
				sort: 'position' | 'createdAt' | 'updatedAt';
				order: 'asc' | 'desc';
			}
		) {
			await ensureProductExists(productId);
			return dependencies.repository.listImages(productId, query);
		},

		async getImage(productId: string, imageId: string): Promise<CatalogImageRecord> {
			await ensureProductExists(productId);
			return ensureImage(await dependencies.repository.findImageById(productId, imageId));
		},

		async createImage(
			productId: string,
			input: {
				uploadId: string;
				skuId?: string | null;
				altText: string;
				placement: 'thumbnail' | 'shared-gallery' | 'sku-gallery';
				focusX?: number | null;
				focusY?: number | null;
				zoom?: number | null;
			}
		): Promise<CatalogImageRecord> {
			await ensureProductExists(productId);
			if (input.placement === 'sku-gallery' && input.skuId) {
				await ensureSkuBelongsToProduct(productId, input.skuId);
			}
			const upload = await dependencies.repository.findImageUpload(productId, input.uploadId);
			if (!upload || upload.expiresAt <= new Date()) {
				throw new AppError(
					409,
					'IMAGE_UPLOAD_EXPIRED',
					'The image upload is missing or has expired. Upload the image again.'
				);
			}
			const promotedAsset = await dependencies.objectStorage.promoteImageAsset(productId, {
				assetKey: upload.assetKey
			});
			let image: CatalogImageRecord | null;
			try {
				image = await dependencies.repository.consumeImageUpload(productId, input.uploadId, {
					uploadAssetKey: upload.assetKey,
					skuId: input.skuId,
					imageUrl: promotedAsset.imageUrl,
					assetKey: promotedAsset.assetKey,
					altText: input.altText,
					placement: input.placement,
					focusX: input.focusX,
					focusY: input.focusY,
					zoom: input.zoom
				});
			} catch (error) {
				await dependencies.objectStorage
					.deleteImageAsset(promotedAsset.assetKey)
					.catch(() => undefined);
				throw error;
			}
			if (!image) {
				await dependencies.objectStorage
					.deleteImageAsset(promotedAsset.assetKey)
					.catch(() => undefined);
				throw new AppError(
					409,
					'IMAGE_UPLOAD_ALREADY_USED',
					'The image upload has already been registered.'
				);
			}
			await dependencies.objectStorage
				.deleteImageUploadAsset(upload.assetKey)
				.catch(() => undefined);
			return image;
		},

		async createImageUploadTarget(
			productId: string,
			input: {
				fileName: string;
				contentType: string;
				fileSize: number;
			}
		) {
			await ensureProductExists(productId);
			const uploadTarget = await dependencies.objectStorage.createImageUploadTarget(
				productId,
				input
			);
			let upload: Awaited<ReturnType<CatalogRepository['createImageUpload']>>;
			try {
				upload = await dependencies.repository.createImageUpload({
					productId,
					assetKey: uploadTarget.assetKey,
					expiresAt: new Date(uploadTarget.expiresAt)
				});
			} catch (error) {
				await dependencies.objectStorage
					.deleteImageUploadAsset(uploadTarget.assetKey)
					.catch(() => undefined);
				throw error;
			}
			return { ...uploadTarget, uploadId: upload.id };
		},

		async deleteImage(
			productId: string,
			imageId: string,
			input: {
				force: boolean;
				deleteAsset: boolean;
			}
		): Promise<{
			mode: 'soft' | 'force';
			assetDeleted: boolean;
		}> {
			await ensureProductExists(productId);
			const image = ensureImage(
				await dependencies.repository.findImageById(productId, imageId, input.force)
			);

			if (input.force) {
				if (image.assetKey) {
					await dependencies.objectStorage.deleteImageAsset(image.assetKey);
				}
				await dependencies.repository.forceDeleteImage(image.id);
				return {
					mode: 'force',
					assetDeleted: Boolean(image.assetKey)
				};
			}

			await dependencies.repository.softDeleteImage(image.id);
			return {
				mode: 'soft',
				assetDeleted: false
			};
		},

		async restoreImage(productId: string, imageId: string): Promise<CatalogImageRecord> {
			await ensureProductExists(productId);
			const image = ensureImage(
				await dependencies.repository.findImageById(productId, imageId, true)
			);
			if (!image.deletedAt) {
				throw new AppError(409, 'IMAGE_NOT_DELETED', 'The product image is not deleted.');
			}
			return dependencies.repository.restoreImage(image.id);
		},

		async updateImageCrop(
			productId: string,
			imageId: string,
			input: { focusX: number; focusY: number; zoom: number }
		): Promise<CatalogImageRecord> {
			await ensureProductExists(productId);
			const image = ensureImage(await dependencies.repository.findImageById(productId, imageId));
			if (image.placement !== 'thumbnail') {
				throw new AppError(
					409,
					'IMAGE_CROP_NOT_SUPPORTED',
					'Only thumbnail images support crop positioning.'
				);
			}
			return dependencies.repository.updateImageCrop(image.id, input);
		},

		async pruneExpiredAssets(now = new Date()): Promise<{ images: number; uploads: number }> {
			const imageCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
			const [images, uploads] = await Promise.all([
				dependencies.repository.listExpiredImages(imageCutoff),
				dependencies.repository.listExpiredImageUploads(now)
			]);
			for (const image of images) {
				if (image.assetKey) await dependencies.objectStorage.deleteImageAsset(image.assetKey);
				await dependencies.repository.forceDeleteImage(image.id);
			}
			for (const upload of uploads) {
				await dependencies.objectStorage.deleteImageUploadAsset(upload.assetKey);
				await dependencies.repository.deleteImageUpload(upload.id);
			}
			return { images: images.length, uploads: uploads.length };
		}
	};
}

export type ImageService = ReturnType<typeof createImageService>;
