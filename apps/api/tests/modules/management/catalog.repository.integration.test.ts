import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { createDatabaseClient } from '@packages/database';
import { Pool } from 'pg';

import { createPrismaCatalogRepository } from '../../../src/modules/management/catalog.repository.js';

const databaseUrl = process.env['TEST_DATABASE_URL'];

test(
	'catalog repository consumes a source upload once while storing its normalized asset key',
	{ skip: databaseUrl ? false : 'TEST_DATABASE_URL is not configured.' },
	async () => {
		const pool = new Pool({ connectionString: databaseUrl, max: 3 });
		const database = createDatabaseClient({ pool });
		const repository = createPrismaCatalogRepository(database);
		const unique = randomUUID();
		const product = await database.product.create({
			data: { slug: `image-integration-${unique}`, name: 'Image integration product' }
		});
		const uploadAssetKey = `products/skus/${product.id}/${unique}.png`;
		const normalizedAssetKey = `products/skus/${product.id}/${randomUUID()}.webp`;
		const upload = await repository.createImageUpload({
			productId: product.id,
			assetKey: uploadAssetKey,
			expiresAt: new Date(Date.now() + 60_000)
		});

		try {
			const input = {
				uploadAssetKey,
				imageUrl: `https://cdn.example.com/${normalizedAssetKey}`,
				assetKey: normalizedAssetKey,
				altText: 'Normalized product image',
				placement: 'shared-gallery' as const
			};
			const image = await repository.consumeImageUpload(product.id, upload.id, input);

			assert.ok(image);
			assert.equal(image.assetKey, normalizedAssetKey);
			assert.ok(
				(await database.productImageUpload.findUniqueOrThrow({ where: { id: upload.id } }))
					.consumedAt
			);
			assert.equal(await repository.consumeImageUpload(product.id, upload.id, input), null);

			const thumbnailUploads = await Promise.all(
				Array.from({ length: 2 }, () =>
					repository.createImageUpload({
						productId: product.id,
						assetKey: `products/skus/${product.id}/${randomUUID()}.png`,
						expiresAt: new Date(Date.now() + 60_000)
					})
				)
			);
			const thumbnails = await Promise.all(
				thumbnailUploads.map((thumbnailUpload) =>
					repository.consumeImageUpload(product.id, thumbnailUpload.id, {
						uploadAssetKey: thumbnailUpload.assetKey,
						imageUrl: `https://cdn.example.com/${randomUUID()}.webp`,
						assetKey: `products/skus/${product.id}/${randomUUID()}.webp`,
						altText: 'Concurrent thumbnail',
						placement: 'thumbnail',
						focusX: 0.5,
						focusY: 0.5,
						zoom: 1
					})
				)
			);
			assert.equal(thumbnails.filter(Boolean).length, 2);

			const currentProduct = await database.product.findUniqueOrThrow({
				where: { id: product.id }
			});
			const storedThumbnails = await database.productImage.findMany({
				where: { id: { in: thumbnails.flatMap((thumbnail) => (thumbnail ? [thumbnail.id] : [])) } }
			});
			assert.equal(storedThumbnails.length, 2);
			assert.equal(
				storedThumbnails.filter(
					(thumbnail) =>
						thumbnail.focusX !== null && thumbnail.id === currentProduct.thumbnailImageId
				).length,
				1
			);
			assert.equal(
				storedThumbnails.filter(
					(thumbnail) =>
						thumbnail.focusX === null && thumbnail.id !== currentProduct.thumbnailImageId
				).length,
				1
			);
			assert.equal(await database.productImage.count({ where: { productId: product.id } }), 3);
		} finally {
			await database.productImage.deleteMany({ where: { productId: product.id } });
			await database.productImageUpload.deleteMany({ where: { productId: product.id } });
			await database.product.delete({ where: { id: product.id } });
			await database.$disconnect();
			await pool.end();
		}
	}
);
