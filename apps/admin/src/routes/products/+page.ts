import { formatDateTime, loadProductPageData } from '$lib/api/admin-api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	const params = new URLSearchParams(url.searchParams);
	params.set('includeDeleted', url.searchParams.get('archived') === 'true' ? 'true' : 'false');
	params.set('includeSkus', 'true');
	const { categories, products, pagination } = await loadProductPageData(params);
	const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
	return {
		products: products.map((product) => ({
			...product,
			isDeleted: product.deletedAt !== null,
			categoryName: product.categoryId
				? (categoryNames.get(product.categoryId) ?? '未知分類')
				: '未分類',
			skuCount: product.skus.length,
			updatedLabel: formatDateTime(product.updatedAt)
		})),
		pagination,
		categoryOptions: [
			{ label: '未分類', value: '' },
			...categories.map((category) => ({ label: category.name, value: category.id }))
		]
	};
};
