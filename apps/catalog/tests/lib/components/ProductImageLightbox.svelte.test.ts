import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';

import ProductImageLightbox from '$lib/components/ProductImageLightbox.svelte';
import type { CatalogImageRecord } from '$lib/catalog/types.js';

function createImage(id: string): CatalogImageRecord {
	return {
		id,
		skuId: 'sku-1',
		imageUrl: `https://assets.example.com/${id}.png`,
		assetKey: `products/${id}.png`,
		altText: `${id} image`,
		type: 'gallery',
		position: 0,
		focusX: null,
		focusY: null,
		zoom: null,
		deletedAt: null,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z'
	};
}

test('lightbox opens, navigates images, and closes through its controls', async () => {
	const onclose = vi.fn();
	const onselect = vi.fn();
	const screen = await render(ProductImageLightbox, {
		open: true,
		productName: '商品',
		images: [createImage('first'), createImage('second')],
		selectedIndex: 0,
		galleryLabel: '商品圖片檢視器',
		closeLabel: '關閉',
		previousLabel: '上一張',
		nextLabel: '下一張',
		onclose,
		onselect
	});

	await expect.element(screen.getByRole('dialog', { name: '商品圖片檢視器' })).toBeVisible();
	await screen.getByRole('button', { name: '下一張' }).click();
	expect(onselect).toHaveBeenLastCalledWith(1);

	await screen.getByRole('button', { name: '關閉' }).click();
	expect(onclose).toHaveBeenCalledOnce();
});
