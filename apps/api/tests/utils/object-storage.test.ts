import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../src/errors/app-error.js';
import { createR2ObjectStorage } from '../../src/utils/object-storage.js';

test('createR2ObjectStorage generates a sku-scoped presigned upload target', async () => {
	let signedCommandInput: unknown;
	let signedExpiresIn: number | undefined;

	const storage = createR2ObjectStorage(
		{
			accountId: 'account-id',
			bucketName: 'catalog-assets',
			accessKeyId: 'access-key-id',
			secretAccessKey: 'secret-access-key',
			publicBaseUrl: 'https://assets.example.com',
			assetKeyPrefix: 'products/skus',
			uploadUrlTtlSeconds: 900
		},
		{
			createId: () => '0189076c-4f2a-7fe1-b9fd-2d68df455999',
			now: () => new Date('2026-06-13T10:00:00.000Z'),
			s3Client: {
				send: async () => undefined
			},
			signUrl: async (
				_client: unknown,
				command: { input: unknown },
				options: { expiresIn: number }
			) => {
				signedCommandInput = command.input;
				signedExpiresIn = options.expiresIn;
				return 'https://signed-upload.example.com';
			}
		}
	);

	const result = await storage.createImageUploadTarget('93f99825-2962-4a10-b453-daa375ff1c43', {
		fileName: 'Front View.PNG',
		contentType: 'image/png'
	});

	assert.equal(
		result.assetKey,
		'products/skus/93f99825-2962-4a10-b453-daa375ff1c43/0189076c-4f2a-7fe1-b9fd-2d68df455999.png'
	);
	assert.equal(result.imageUrl, `https://assets.example.com/${result.assetKey}`);
	assert.equal(result.uploadUrl, 'https://signed-upload.example.com');
	assert.deepEqual(result.headers, {
		'Content-Type': 'image/png'
	});
	assert.equal(result.method, 'PUT');
	assert.equal(result.expiresAt, '2026-06-13T10:15:00.000Z');
	assert.deepEqual(signedCommandInput, {
		Bucket: 'catalog-assets',
		Key: result.assetKey,
		ContentType: 'image/png'
	});
	assert.equal(signedExpiresIn, 900);
});

test('createR2ObjectStorage rejects asset keys outside the sku path', async () => {
	const storage = createR2ObjectStorage(
		{
			accountId: 'account-id',
			bucketName: 'catalog-assets',
			accessKeyId: 'access-key-id',
			secretAccessKey: 'secret-access-key',
			publicBaseUrl: 'https://assets.example.com',
			assetKeyPrefix: 'products/skus',
			uploadUrlTtlSeconds: 900
		},
		{
			createId: () => '0189076c-4f2a-7fe1-b9fd-2d68df455999',
			now: () => new Date('2026-06-13T10:00:00.000Z'),
			s3Client: {
				send: async () => undefined
			},
			signUrl: async () => 'https://signed-upload.example.com'
		}
	);

	await assert.rejects(
		() =>
			storage.assertImageAssetExists('93f99825-2962-4a10-b453-daa375ff1c43', {
				assetKey: 'products/skus/other-sku/asset.png'
			}),
		(error: unknown) => error instanceof AppError && error.code === 'INVALID_IMAGE_ASSET_KEY'
	);
});
