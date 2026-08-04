import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Router, raw } from 'express';
import {
	imageDeleteResponseSchema,
	imageUploadTargetResponseSchema,
	managedProductImageResponseSchema,
	managementProductImageListQuerySchema,
	paginatedResponseSchema,
	productImageCreateSchema,
	productImageCropUpdateSchema,
	productImageDeleteQuerySchema,
	productImageUploadRequestSchema
} from '@packages/schemas';
import { MockHttpError, notFound } from '../http/errors.js';
import { compareValues, paginate } from '../http/pagination.js';
import { parseBody, parseQuery, sendJson } from '../http/validation.js';
import type { MockState } from '../state.js';
import { assertDomainHealthy, projectImage } from './shared.js';

const fixtureDirectory = fileURLToPath(new URL('../../fixtures/images/', import.meta.url));
const fixtureFiles = new Set(['beaker.svg', 'beaker-detail.svg', 'funnel.svg', 'deleted.svg']);

function findProduct(state: MockState, productId: string) {
	return state.products.find((product) => product.id === productId) ?? notFound();
}

function findImage(state: MockState, productId: string, imageId: string) {
	return (
		state.images.find((image) => image.id === imageId && image.productId === productId) ??
		notFound()
	);
}

export function createImageRouter(state: MockState, publicOrigin: string): Router {
	const router = Router();

	router.get('/:productId/images', (request, response) => {
		assertDomainHealthy(state, 'products');
		const productId = request.params['productId'] ?? '';
		findProduct(state, productId);
		const query = parseQuery(request, managementProductImageListQuerySchema);
		let images = state.images.filter((image) => {
			if (image.productId !== productId) return false;
			if (query.state === 'deleted' && !image.deletedAt) return false;
			if (query.state === 'active' && image.deletedAt) return false;
			if (query.placement && image.placement !== query.placement) return false;
			return true;
		});
		images = [...images].sort((left, right) =>
			compareValues(left[query.sort], right[query.sort], query.order)
		);
		const page = paginate(images, query);
		sendJson(response, paginatedResponseSchema(managedProductImageResponseSchema), {
			...page,
			data: page.data.map((image) => projectImage(image, publicOrigin))
		});
	});

	router.post('/:productId/images/upload-url', (request, response) => {
		assertDomainHealthy(state, 'products');
		const productId = request.params['productId'] ?? '';
		findProduct(state, productId);
		const input = parseBody(request, productImageUploadRequestSchema);
		const uploadId = randomUUID();
		const assetKey = `upload:${uploadId}`;
		state.imageUploads.set(uploadId, {
			id: uploadId,
			productId,
			fileName: input.fileName,
			contentType: input.contentType,
			fileSize: input.fileSize,
			assetKey,
			bytes: null,
			createdAt: new Date()
		});
		sendJson(
			response,
			imageUploadTargetResponseSchema,
			{
				uploadId,
				uploadUrl: `${publicOrigin}/mock/uploads/${uploadId}`,
				assetKey,
				expiresAt: new Date(Date.now() + 15 * 60 * 1000)
			},
			201
		);
	});

	router.post('/:productId/images', (request, response) => {
		assertDomainHealthy(state, 'products');
		const productId = request.params['productId'] ?? '';
		findProduct(state, productId);
		const input = parseBody(request, productImageCreateSchema);
		const upload = state.imageUploads.get(input.uploadId);
		if (!upload || upload.productId !== productId)
			notFound('The image upload target could not be found.');
		if (!upload.bytes) {
			throw new MockHttpError(409, 'RELATION_CONFLICT', 'Upload bytes have not been received yet.');
		}
		if (input.skuId) {
			const sku = state.skus.find(
				(entry) => entry.id === input.skuId && entry.productId === productId
			);
			if (!sku) notFound('The selected SKU could not be found.');
		}
		if (input.placement === 'thumbnail') {
			for (const image of state.images) {
				if (
					image.productId === productId &&
					image.skuId === null &&
					image.placement === 'thumbnail' &&
					image.deletedAt === null
				) {
					image.placement = 'shared-gallery';
					image.updatedAt = new Date();
				}
			}
		}
		const now = new Date();
		const image = {
			id: randomUUID(),
			productId,
			skuId: input.skuId ?? null,
			imageUrl: `${publicOrigin}/mock/assets/pending`,
			assetKey: upload.assetKey,
			altText: input.altText,
			placement: input.placement,
			position: state.images.filter(
				(entry) => entry.productId === productId && entry.placement === input.placement
			).length,
			focusX: input.focusX ?? null,
			focusY: input.focusY ?? null,
			zoom: input.zoom ?? null,
			deletedAt: null,
			createdAt: now,
			updatedAt: now
		};
		state.images.push(image);
		sendJson(response, managedProductImageResponseSchema, projectImage(image, publicOrigin), 201);
	});

	router.patch('/:productId/images/:imageId/crop', (request, response) => {
		assertDomainHealthy(state, 'products');
		const input = parseBody(request, productImageCropUpdateSchema);
		const image = findImage(
			state,
			request.params['productId'] ?? '',
			request.params['imageId'] ?? ''
		);
		if (image.placement !== 'thumbnail') {
			throw new MockHttpError(
				409,
				'RELATION_CONFLICT',
				'Only thumbnail images support crop positioning.'
			);
		}
		image.focusX = input.focusX;
		image.focusY = input.focusY;
		image.zoom = input.zoom;
		image.updatedAt = new Date();
		sendJson(response, managedProductImageResponseSchema, projectImage(image, publicOrigin));
	});

	router.delete('/:productId/images/:imageId', (request, response) => {
		assertDomainHealthy(state, 'products');
		const query = parseQuery(request, productImageDeleteQuerySchema);
		const productId = request.params['productId'] ?? '';
		const imageId = request.params['imageId'] ?? '';
		const image = findImage(state, productId, imageId);
		if (query.force) {
			const index = state.images.indexOf(image);
			state.images.splice(index, 1);
			if (image.assetKey?.startsWith('upload:') && query.deleteAsset) {
				state.imageUploads.delete(image.assetKey.slice('upload:'.length));
			}
			sendJson(response, imageDeleteResponseSchema, {
				deleted: true,
				mode: 'force',
				assetDeleted: query.deleteAsset
			});
			return;
		}
		image.deletedAt = new Date();
		image.updatedAt = image.deletedAt;
		sendJson(response, imageDeleteResponseSchema, {
			deleted: true,
			mode: 'soft',
			assetDeleted: false
		});
	});

	router.post('/:productId/images/:imageId/restore', (request, response) => {
		assertDomainHealthy(state, 'products');
		const image = findImage(
			state,
			request.params['productId'] ?? '',
			request.params['imageId'] ?? ''
		);
		image.deletedAt = null;
		image.updatedAt = new Date();
		sendJson(response, managedProductImageResponseSchema, projectImage(image, publicOrigin));
	});

	return router;
}

export function createMockAssetRouter(state: MockState): Router {
	const router = Router();

	router.put('/uploads/:uploadId', raw({ type: '*/*', limit: '10mb' }), (request, response) => {
		const upload = state.imageUploads.get(request.params['uploadId'] ?? '');
		if (!upload) notFound('The image upload target could not be found.');
		const body = request.body;
		if (!Buffer.isBuffer(body)) {
			throw new MockHttpError(400, 'VALIDATION_FAILED', 'Uploaded image body must be binary data.');
		}
		if (body.byteLength !== upload.fileSize) {
			throw new MockHttpError(
				400,
				'VALIDATION_FAILED',
				'Uploaded image size does not match the requested upload target.'
			);
		}
		upload.bytes = Buffer.from(body);
		response.status(200).end();
	});

	router.get('/assets/:imageId', (request, response) => {
		const image =
			state.images.find((entry) => entry.id === request.params['imageId']) ?? notFound();
		if (!image.assetKey?.startsWith('upload:')) notFound('This image is not an in-memory upload.');
		const upload = state.imageUploads.get(image.assetKey.slice('upload:'.length));
		if (!upload?.bytes) notFound('Uploaded image bytes are unavailable.');
		response.type(upload.contentType).send(upload.bytes);
	});

	router.get('/fixtures/:fileName', async (request, response) => {
		const fileName = request.params['fileName'] ?? '';
		if (!fixtureFiles.has(fileName)) notFound();
		const bytes = await readFile(`${fixtureDirectory}${fileName}`);
		response.type('image/svg+xml').send(bytes);
	});

	return router;
}
