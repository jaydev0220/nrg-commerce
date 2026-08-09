import type {
	MockBusiness,
	MockCategory,
	MockProduct,
	MockProductImage,
	MockSku,
	MockState,
	FailureDomain
} from '../state.js';
import { MockHttpError } from '../http/errors.js';

export function assertDomainHealthy(state: MockState, domain: FailureDomain): void {
	if (!state.failureDomains.has(domain)) return;
	throw new MockHttpError(
		500,
		'MOCK_SCENARIO_FAILURE',
		`The ${domain} API is unavailable in the active mock scenario.`
	);
}

export function categoryFor(state: MockState, id: string | null): MockCategory | null {
	if (!id) return null;
	return state.categories.find((category) => category.id === id) ?? null;
}

export function imageUrl(image: MockProductImage, publicOrigin: string): string {
	if (image.assetKey?.startsWith('fixture:')) {
		return `${publicOrigin}/mock/fixtures/${encodeURIComponent(image.assetKey.slice('fixture:'.length))}`;
	}
	return `${publicOrigin}/mock/assets/${image.id}`;
}

export function projectImage(image: MockProductImage, publicOrigin: string) {
	return { ...image, imageUrl: imageUrl(image, publicOrigin) };
}

export function projectManagedSku(
	state: MockState,
	sku: MockSku,
	publicOrigin: string,
	includeImages = true,
	includeDeletedImages = false
) {
	const product = state.products.find((entry) => entry.id === sku.productId);
	if (!product) {
		throw new MockHttpError(500, 'MOCK_DATA_INTEGRITY', `SKU ${sku.id} has no product.`);
	}
	const category = categoryFor(state, product.categoryId);
	const images = includeImages
		? state.images
				.filter(
					(image) => image.skuId === sku.id && (includeDeletedImages || image.deletedAt === null)
				)
				.sort((left, right) => left.position - right.position)
				.map((image) => projectImage(image, publicOrigin))
		: [];
	return {
		id: sku.id,
		productId: sku.productId,
		productSlug: product.slug,
		skuCode: sku.skuCode,
		name: product.name,
		nameEn: product.nameEn,
		description: product.description,
		descriptionEn: product.descriptionEn,
		categoryId: product.categoryId,
		categorySlug: category?.slug ?? null,
		price: sku.price,
		stockQuantity: sku.stockQuantity,
		availability: sku.stockQuantity > 0 ? ('in_stock' as const) : ('out_of_stock' as const),
		published: product.published,
		attributes: sku.attributes,
		notes: sku.notes,
		deletedAt: sku.deletedAt,
		createdAt: sku.createdAt,
		updatedAt: sku.updatedAt,
		images
	};
}

export function projectManagedProduct(
	state: MockState,
	product: MockProduct,
	publicOrigin: string,
	options: { includeSkus?: boolean; includeImages?: boolean } = {}
) {
	const category = categoryFor(state, product.categoryId);
	const activeImages = options.includeImages
		? state.images
				.filter((image) => image.productId === product.id && image.deletedAt === null)
				.sort((left, right) => left.position - right.position)
		: [];
	const productImages = activeImages.map((image) => projectImage(image, publicOrigin));
	return {
		...product,
		categorySlug: category?.slug ?? null,
		thumbnail:
			productImages.find((image) => image.placement === 'thumbnail' && image.skuId === null) ??
			null,
		images: productImages,
		skus: options.includeSkus
			? state.skus
					.filter((sku) => sku.productId === product.id)
					.map((sku) => projectManagedSku(state, sku, publicOrigin, options.includeImages))
			: []
	};
}

export function projectBusiness(state: MockState, business: MockBusiness) {
	return {
		...business,
		label: state.businessLabels.find((label) => label.id === business.labelId) ?? null
	};
}

function iso(date: Date | null): string | null {
	return date?.toISOString() ?? null;
}

function storefrontImage(image: MockProductImage, publicOrigin: string) {
	return {
		...projectImage(image, publicOrigin),
		deletedAt: iso(image.deletedAt),
		createdAt: image.createdAt.toISOString(),
		updatedAt: image.updatedAt.toISOString()
	};
}

export function projectStorefrontProduct(
	state: MockState,
	product: MockProduct,
	publicOrigin: string,
	options: { includeSkus?: boolean; includeImages?: boolean } = {}
) {
	const category = categoryFor(state, product.categoryId);
	const activeImages = options.includeImages
		? state.images
				.filter((image) => image.productId === product.id && image.deletedAt === null)
				.sort((left, right) => left.position - right.position)
		: [];
	const productImages = activeImages.map((image) => storefrontImage(image, publicOrigin));
	const { notes: _notes, baseUnit: _baseUnit, ...publicProduct } = product;
	void _notes;
	void _baseUnit;
	const skus = options.includeSkus
		? state.skus
				.filter((sku) => sku.productId === product.id && sku.deletedAt === null)
				.map((sku) => ({
					id: sku.id,
					productId: sku.productId,
					productSlug: product.slug,
					skuCode: sku.skuCode,
					name: product.name,
					nameEn: product.nameEn,
					description: product.description,
					descriptionEn: product.descriptionEn,
					categoryId: product.categoryId,
					categorySlug: category?.slug ?? null,
					price: sku.price,
					availability: sku.stockQuantity > 0 ? ('in_stock' as const) : ('out_of_stock' as const),
					published: product.published,
					attributes: sku.attributes,
					deletedAt: iso(sku.deletedAt),
					createdAt: sku.createdAt.toISOString(),
					updatedAt: sku.updatedAt.toISOString(),
					images: options.includeImages
						? activeImages
								.filter((image) => image.skuId === sku.id)
								.map((image) => storefrontImage(image, publicOrigin))
						: []
				}))
		: [];
	return {
		...publicProduct,
		categorySlug: category?.slug ?? null,
		deletedAt: iso(product.deletedAt),
		createdAt: product.createdAt.toISOString(),
		updatedAt: product.updatedAt.toISOString(),
		thumbnail:
			productImages.find((image) => image.placement === 'thumbnail' && image.skuId === null) ??
			null,
		images: productImages,
		skus
	};
}

export function categoryProductCount(state: MockState, categoryId: string): number {
	return state.products.filter(
		(product) =>
			product.categoryId === categoryId && product.deletedAt === null && product.published
	).length;
}

export function projectStorefrontCategory(
	state: MockState,
	category: MockCategory,
	withCount: boolean
) {
	return {
		...category,
		deletedAt: iso(category.deletedAt),
		createdAt: category.createdAt.toISOString(),
		updatedAt: category.updatedAt.toISOString(),
		...(withCount ? { productCount: categoryProductCount(state, category.id) } : {})
	};
}
