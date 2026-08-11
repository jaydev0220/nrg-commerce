import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';

import CatalogFilters from '$lib/components/CatalogFilters.svelte';
import ProductCard from '$lib/components/ProductCard.svelte';

const category = (id: string, parentId: string | null, productCount?: number) => ({
	id,
	name: `分類 ${id}`,
	nameEn: `Category ${id}`,
	slug: id,
	description: null,
	descriptionEn: null,
	position: 0,
	parentId,
	deletedAt: null,
	createdAt: '2026-07-19T00:00:00.000Z',
	updatedAt: '2026-07-19T00:00:00.000Z',
	productCount,
	children: []
});

test('renders populated category navigation and delegates reset actions', async () => {
	const onReset = vi.fn();
	const screen = await render(CatalogFilters, {
		locale: 'en',
		categoryList: [
			{ category: category('root', null, 3), depth: 0 },
			{ category: category('child', 'root'), depth: 1 }
		],
		selectedCategorySlug: 'child',
		onReset
	});

	await expect
		.element(screen.getByRole('link', { name: 'Category root 3' }))
		.toHaveAttribute('href', '/en/categories/root');
	await expect
		.element(screen.getByRole('link', { name: 'Category child' }))
		.toHaveAttribute('href', '/en/categories/child');
	await screen.getByRole('button').click();
	expect(onReset).toHaveBeenCalledOnce();
});

test('renders product-card descriptions literally across image and metadata variants', async () => {
	const description = '**Plain description** <script>alert("unsafe")</script>';
	const baseView = {
		id: 'product-1',
		slug: 'beaker',
		name: 'Beaker',
		description,
		categorySlug: 'glassware',
		minimumPrice: 120,
		maximumPrice: 120,
		skuCount: 1,
		representativeImage: null,
		product: {}
	};
	const withoutImage = await render(ProductCard, {
		view: baseView,
		categoryLabel: 'Glassware',
		href: '/beaker'
	} as never);

	expect(withoutImage.container.querySelector('p.mt-2')?.textContent).toBe(description);
	expect(withoutImage.container.querySelector('strong, script')).toBeNull();
	await expect.element(withoutImage.getByText('Glassware')).toBeVisible();

	const withImage = await render(ProductCard, {
		view: {
			...baseView,
			description: null,
			skuCount: 2,
			representativeImage: {
				imageUrl: 'https://catalog.example.com/beaker.jpg',
				altText: 'Laboratory beaker',
				focusX: 0.25,
				focusY: 0.75,
				zoom: 1.5
			}
		},
		categoryLabel: null,
		href: '/beaker'
	} as never);
	const image = withImage.getByRole('img', { name: 'Laboratory beaker' });

	await expect
		.element(image)
		.toHaveAttribute(
			'style',
			'object-position: 25% 75%; transform: scale(1.5); transform-origin: 25% 75%;'
		);
	expect(withImage.container.querySelector('p.mt-2')).toBeNull();
});
