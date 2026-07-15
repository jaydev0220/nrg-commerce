import { AppError } from '../../../errors/app-error.js';
import type { ImageObjectStorage } from '../../../utils/object-storage.js';

import type { CatalogImageRecord } from '../../../types/catalog.js';
import type { CatalogRepository } from '../catalog.repository.js';

type ImageServiceDependencies = {
	repository: Pick<
		CatalogRepository,
		| 'findSkuById'
		| 'listImages'
		| 'findImageById'
		| 'createImageUpload'
		| 'findImageUpload'
		| 'consumeImageUpload'
		| 'updateImageFocus'
		| 'softDeleteImage'
		| 'forceDeleteImage'
		| 'restoreImage'
		| 'listExpiredImages'
		| 'listExpiredImageUploads'
		| 'deleteImageUpload'
	>;
	objectStorage: Pick<
		ImageObjectStorage,
		'createImageUploadTarget' | 'assertImageAssetExists' | 'deleteImageAsset'
	>;
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
				state: 'active' | 'deleted';
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
				uploadId: string;
				altText: string;
				type: 'thumbnail' | 'gallery';
				focusX?: number | null;
				focusY?: number | null;
			}
		): Promise<CatalogImageRecord> {
			await ensureSkuExists(skuId);
			const upload = await dependencies.repository.findImageUpload(skuId, input.uploadId);
			if (!upload || upload.expiresAt <= new Date()) {
				throw new AppError(
					409,
					'IMAGE_UPLOAD_EXPIRED',
					'The image upload is missing or has expired. Upload the image again.'
				);
			}
			const uploadedAsset = await dependencies.objectStorage.assertImageAssetExists(skuId, {
				assetKey: upload.assetKey
			});
			const image = await dependencies.repository.consumeImageUpload(skuId, input.uploadId, {
				imageUrl: uploadedAsset.imageUrl,
				assetKey: uploadedAsset.assetKey,
				altText: input.altText,
				type: input.type,
				focusX: input.focusX,
				focusY: input.focusY
			});
			if (!image) {
				throw new AppError(
					409,
					'IMAGE_UPLOAD_ALREADY_USED',
					'The image upload has already been registered.'
				);
			}
			return image;
		},

		async createImageUploadTarget(
			skuId: string,
			input: {
				fileName: string;
				contentType: string;
				fileSize: number;
			}
		) {
			await ensureSkuExists(skuId);
			const uploadTarget = await dependencies.objectStorage.createImageUploadTarget(skuId, input);
			let upload: Awaited<ReturnType<CatalogRepository['createImageUpload']>>;
			try {
				upload = await dependencies.repository.createImageUpload({
					skuId,
					assetKey: uploadTarget.assetKey,
					expiresAt: new Date(uploadTarget.expiresAt)
				});
			} catch (error) {
				await dependencies.objectStorage
					.deleteImageAsset(uploadTarget.assetKey)
					.catch(() => undefined);
				throw error;
			}
			return { ...uploadTarget, uploadId: upload.id };
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
			const image = ensureImage(
				await dependencies.repository.findImageById(skuId, imageId, input.force)
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

		async restoreImage(skuId: string, imageId: string): Promise<CatalogImageRecord> {
			await ensureSkuExists(skuId);
			const image = ensureImage(await dependencies.repository.findImageById(skuId, imageId, true));
			if (!image.deletedAt) {
				throw new AppError(409, 'IMAGE_NOT_DELETED', 'The product image is not deleted.');
			}
			return dependencies.repository.restoreImage(image.id);
		},

		async updateImageFocus(
			skuId: string,
			imageId: string,
			input: { focusX: number; focusY: number }
		): Promise<CatalogImageRecord> {
			await ensureSkuExists(skuId);
			const image = ensureImage(await dependencies.repository.findImageById(skuId, imageId));
			if (image.type !== 'thumbnail') {
				throw new AppError(
					409,
					'IMAGE_FOCUS_NOT_SUPPORTED',
					'Only thumbnail images support a focus point.'
				);
			}
			return dependencies.repository.updateImageFocus(image.id, input);
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
				await dependencies.objectStorage.deleteImageAsset(upload.assetKey);
				await dependencies.repository.deleteImageUpload(upload.id);
			}
			return { images: images.length, uploads: uploads.length };
		}
	};
}

export type ImageService = ReturnType<typeof createImageService>;
