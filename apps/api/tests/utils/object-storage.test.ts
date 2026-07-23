import assert from 'node:assert/strict';
import test from 'node:test';

import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand
} from '@aws-sdk/client-s3';
import sharp from 'sharp';

import { AppError } from '../../src/errors/app-error.js';
import { createR2ObjectStorage, normalizeProductImage } from '../../src/utils/object-storage.js';

const productId = '93f99825-2962-4a10-b453-daa375ff1c43';

function storageConfig() {
	return {
		accountId: 'account-id',
		bucketName: 'catalog-assets',
		uploadBucketName: 'catalog-uploads',
		accessKeyId: 'access-key-id',
		secretAccessKey: 'secret-access-key',
		publicBaseUrl: 'https://assets.example.com',
		assetKeyPrefix: 'products/skus',
		uploadUrlTtlSeconds: 900
	};
}

test('createR2ObjectStorage generates a private presigned upload target', async () => {
	let signedCommandInput: unknown;
	let signedExpiresIn: number | undefined;

	const storage = createR2ObjectStorage(storageConfig(), {
		createId: () => '0189076c-4f2a-7fe1-b9fd-2d68df455999',
		now: () => new Date('2026-06-13T10:00:00.000Z'),
		s3Client: {
			send: async () => undefined
		},
		signUrl: async (_client, command, options) => {
			signedCommandInput = command.input;
			signedExpiresIn = options.expiresIn;
			return 'https://signed-upload.example.com';
		}
	});

	const result = await storage.createImageUploadTarget(productId, {
		fileName: 'Front View.txt',
		contentType: 'image/png',
		fileSize: 1024
	});

	assert.equal(
		result.assetKey,
		'products/skus/93f99825-2962-4a10-b453-daa375ff1c43/0189076c-4f2a-7fe1-b9fd-2d68df455999.png'
	);
	assert.equal(result.uploadUrl, 'https://signed-upload.example.com');
	assert.deepEqual(result.headers, {
		'Content-Type': 'image/png'
	});
	assert.equal(result.method, 'PUT');
	assert.equal(result.expiresAt, '2026-06-13T10:15:00.000Z');
	assert.deepEqual(signedCommandInput, {
		Bucket: 'catalog-uploads',
		Key: result.assetKey,
		ContentType: 'image/png',
		ContentLength: 1024
	});
	assert.equal(signedExpiresIn, 900);
});

test('promoteImageAsset rejects asset keys outside the product path', async () => {
	let calls = 0;
	const storage = createR2ObjectStorage(storageConfig(), {
		s3Client: {
			send: async () => {
				calls += 1;
				return undefined;
			}
		},
		signUrl: async () => 'https://signed-upload.example.com'
	});

	await assert.rejects(
		() =>
			storage.promoteImageAsset(productId, {
				assetKey: 'products/skus/other-product/asset.png'
			}),
		(error: unknown) => error instanceof AppError && error.code === 'INVALID_IMAGE_ASSET_KEY'
	);
	assert.equal(calls, 0);
});

test('promoteImageAsset validates, normalizes, and writes an immutable public object', async () => {
	const putInputs: unknown[] = [];
	const sourceBody = Uint8Array.from([1, 2, 3, 4]);
	const normalizedBody = Uint8Array.from([5, 6, 7]);
	const storage = createR2ObjectStorage(storageConfig(), {
		createId: () => '0189076c-4f2a-7fe1-b9fd-2d68df455998',
		normalizeImage: async (input) => {
			assert.deepEqual(input, sourceBody);
			return normalizedBody;
		},
		s3Client: {
			send: async (command) => {
				if (command instanceof HeadObjectCommand) {
					assert.equal(command.input.Bucket, 'catalog-uploads');
					return { ContentType: 'image/avif', ContentLength: sourceBody.byteLength };
				}
				if (command instanceof GetObjectCommand) {
					assert.equal(command.input.Bucket, 'catalog-uploads');
					return { Body: { transformToByteArray: async () => sourceBody } };
				}
				if (command instanceof PutObjectCommand) {
					putInputs.push(command.input);
				}
				return undefined;
			}
		},
		signUrl: async () => 'https://signed-upload.example.com'
	});
	const uploadKey = `products/skus/${productId}/image.avif`;

	const result = await storage.promoteImageAsset(productId, { assetKey: uploadKey });

	assert.deepEqual(result, {
		assetKey: `products/skus/${productId}/0189076c-4f2a-7fe1-b9fd-2d68df455998.webp`,
		imageUrl: `https://assets.example.com/products/skus/${productId}/0189076c-4f2a-7fe1-b9fd-2d68df455998.webp`,
		contentType: 'image/webp'
	});
	assert.deepEqual(putInputs, [
		{
			Bucket: 'catalog-assets',
			Key: `products/skus/${productId}/0189076c-4f2a-7fe1-b9fd-2d68df455998.webp`,
			Body: normalizedBody,
			ContentLength: normalizedBody.byteLength,
			ContentType: 'image/webp',
			CacheControl: 'public, max-age=31536000, immutable'
		}
	]);
});

test('promoteImageAsset purges invalid pending objects', async () => {
	const deleteInputs: unknown[] = [];
	const storage = createR2ObjectStorage(storageConfig(), {
		s3Client: {
			send: async (command) => {
				if (command instanceof HeadObjectCommand) {
					return { ContentType: 'text/html', ContentLength: 2048 };
				}
				if (command instanceof DeleteObjectCommand) {
					deleteInputs.push(command.input);
				}
				return undefined;
			}
		},
		signUrl: async () => 'https://signed-upload.example.com'
	});
	const uploadKey = `products/skus/${productId}/image.png`;

	await assert.rejects(
		() => storage.promoteImageAsset(productId, { assetKey: uploadKey }),
		(error: unknown) => error instanceof AppError && error.code === 'INVALID_IMAGE_ASSET'
	);
	assert.deepEqual(deleteInputs, [{ Bucket: 'catalog-uploads', Key: uploadKey }]);
});

test('promoteImageAsset rejects mismatched object length and purges the upload', async () => {
	const deleted: unknown[] = [];
	const storage = createR2ObjectStorage(storageConfig(), {
		s3Client: {
			send: async (command) => {
				if (command instanceof HeadObjectCommand) {
					return { ContentType: 'image/png', ContentLength: 4 };
				}
				if (command instanceof GetObjectCommand) {
					return {
						Body: { transformToByteArray: async () => Uint8Array.from([1, 2, 3]) }
					};
				}
				if (command instanceof DeleteObjectCommand) deleted.push(command.input);
				return undefined;
			}
		},
		signUrl: async () => 'https://signed-upload.example.com'
	});
	const uploadKey = `products/skus/${productId}/image.png`;

	await assert.rejects(
		() => storage.promoteImageAsset(productId, { assetKey: uploadKey }),
		(error: unknown) => error instanceof AppError && error.code === 'INVALID_IMAGE_ASSET'
	);
	assert.deepEqual(deleted, [{ Bucket: 'catalog-uploads', Key: uploadKey }]);
});

test('promoteImageAsset maps missing pending objects to a stable API error', async () => {
	const storage = createR2ObjectStorage(storageConfig(), {
		s3Client: {
			send: async () => {
				throw Object.assign(new Error('missing'), { name: 'NotFound' });
			}
		},
		signUrl: async () => 'https://signed-upload.example.com'
	});

	await assert.rejects(
		() =>
			storage.promoteImageAsset(productId, {
				assetKey: `products/skus/${productId}/missing.png`
			}),
		(error: unknown) => error instanceof AppError && error.code === 'IMAGE_ASSET_NOT_FOUND'
	);
});

test('normalizeProductImage decodes image bytes, strips metadata, and emits WebP', async () => {
	const source = await sharp({
		create: {
			width: 2,
			height: 3,
			channels: 4,
			background: { r: 255, g: 0, b: 0, alpha: 1 }
		}
	})
		.withMetadata({ orientation: 6 })
		.png()
		.toBuffer();

	const normalized = await normalizeProductImage(source);
	const metadata = await sharp(normalized).metadata();

	assert.equal(metadata.format, 'webp');
	assert.equal(metadata.width, 3);
	assert.equal(metadata.height, 2);
	assert.equal(metadata.exif, undefined);
	assert.equal(metadata.icc, undefined);

	await assert.rejects(
		() => normalizeProductImage(Uint8Array.from([60, 115, 99, 114, 105, 112, 116, 62])),
		(error: unknown) => error instanceof AppError && error.code === 'INVALID_IMAGE_ASSET'
	);
});

test('delete methods target public and private buckets independently', async () => {
	const deletes: unknown[] = [];
	const storage = createR2ObjectStorage(storageConfig(), {
		s3Client: {
			send: async (command) => {
				if (command instanceof DeleteObjectCommand) deletes.push(command.input);
				return undefined;
			}
		},
		signUrl: async () => 'https://signed-upload.example.com'
	});

	await storage.deleteImageAsset('products/skus/product/image.webp');
	await storage.deleteImageUploadAsset('products/skus/product/upload.png');

	assert.deepEqual(deletes, [
		{ Bucket: 'catalog-assets', Key: 'products/skus/product/image.webp' },
		{ Bucket: 'catalog-uploads', Key: 'products/skus/product/upload.png' }
	]);
});
