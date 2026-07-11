import {
	asPageError,
	formatCompactDate,
	formatCurrencyRange,
	loadProductPageData
} from '$lib/server/admin-api';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	try {
		const { categories, products } = await loadProductPageData(event);
		const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
		const pageProducts = products.map((product) => ({
			id: product.id,
			name: product.name,
			slug: product.slug,
			skuCodes: product.skus.map((sku) => sku.skuCode),
			skuCount: product.skus.length,
			categoryId: product.categoryId,
			categoryName:
				product.categoryId === null
					? '未分類'
					: (categoryNameById.get(product.categoryId) ?? product.categorySlug ?? '已刪除分類'),
			published: product.published,
			priceRange: formatCurrencyRange(product.skus.map((sku) => sku.price)),
			updatedAt: formatCompactDate(product.updatedAt)
		}));

		return {
			categoryOptions: categories.map((category) => ({ label: category.name, value: category.id })),
			products: pageProducts,
			summary: [
				{ label: '商品數', value: String(pageProducts.length) },
				{
					label: '已上架',
					value: String(pageProducts.filter((product) => product.published).length)
				},
				{
					label: '未分類',
					value: String(pageProducts.filter((product) => product.categoryId === null).length)
				}
			]
		};
	} catch (caughtError) {
		return asPageError(caughtError);
	}
};
