import type {
	CatalogCategoryNode,
	CatalogCategoryListEntry,
	CatalogCategoryRecord,
	CatalogImageRecord,
	CatalogJsonValue,
	CatalogLocale,
	CatalogProductRecord,
	CatalogProductView,
	CatalogQueryState,
	CatalogSkuRecord,
	ProductConfigurationModel
} from './types.js';
import { formatAttributeKey, formatAttributeValue, localizeValue } from './ui.js';

function isScalarAttributeValue(
	value: CatalogJsonValue | undefined
): value is string | number | boolean {
	return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function asAttributeText(value: CatalogJsonValue | undefined): string | null {
	if (isScalarAttributeValue(value)) {
		return String(value);
	}

	return null;
}

function normalizeSearchValue(value: string): string {
	return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function flattenCategories(categories: CatalogCategoryNode[]): CatalogCategoryRecord[] {
	return categories.flatMap((category) => [category, ...flattenCategories(category.children)]);
}

export function flattenCategoryNodes(
	categories: CatalogCategoryNode[],
	depth = 0
): CatalogCategoryListEntry[] {
	return categories.flatMap((category) => [
		{ category, depth },
		...flattenCategoryNodes(category.children, depth + 1)
	]);
}

function compareImages(left: CatalogImageRecord, right: CatalogImageRecord): number {
	const typeRank = (image: CatalogImageRecord) => (image.type === 'thumbnail' ? 0 : 1);
	return (
		typeRank(left) - typeRank(right) ||
		left.position - right.position ||
		left.createdAt.localeCompare(right.createdAt) ||
		left.id.localeCompare(right.id)
	);
}

function getSortedImages(sku: CatalogSkuRecord): CatalogImageRecord[] {
	return [...sku.images].sort(compareImages);
}

function getRepresentativeImage(product: CatalogProductRecord): CatalogImageRecord | null {
	for (const sku of product.skus) {
		const [image] = getSortedImages(sku);
		if (image) {
			return image;
		}
	}

	return null;
}

function getSearchTerms(
	product: CatalogProductRecord,
	category: CatalogCategoryRecord | undefined
): string[] {
	const terms = [
		product.slug,
		product.name,
		product.nameEn ?? '',
		product.description ?? '',
		product.descriptionEn ?? '',
		category?.name ?? '',
		category?.nameEn ?? '',
		category?.slug ?? ''
	];

	for (const sku of product.skus) {
		terms.push(sku.skuCode);
		for (const [key, value] of Object.entries(sku.attributes)) {
			terms.push(key);
			const attributeText = asAttributeText(value);
			if (attributeText) {
				terms.push(attributeText);
			}
		}
	}

	return terms;
}

function sortViews(
	views: CatalogProductView[],
	locale: CatalogLocale,
	sort: CatalogQueryState['sort']
) {
	const collator = new Intl.Collator(locale === 'en' ? 'en-US' : 'zh-TW', {
		sensitivity: 'base'
	});

	switch (sort) {
		case 'price-asc':
			return [...views].sort(
				(left, right) =>
					left.minimumPrice - right.minimumPrice || collator.compare(left.name, right.name)
			);
		case 'price-desc':
			return [...views].sort(
				(left, right) =>
					right.minimumPrice - left.minimumPrice || collator.compare(left.name, right.name)
			);
		case 'name':
			return [...views].sort((left, right) => collator.compare(left.name, right.name));
		case 'featured':
		default:
			return [...views].sort(
				(left, right) =>
					right.product.createdAt.localeCompare(left.product.createdAt) ||
					collator.compare(left.name, right.name)
			);
	}
}

export function resolveCategorySlugScope(
	categories: CatalogCategoryNode[],
	categorySlug: string | null
): Set<string> {
	if (!categorySlug) {
		return new Set();
	}

	const scope = new Set<string>();
	const visit = (nodes: CatalogCategoryNode[]): boolean => {
		for (const node of nodes) {
			if (node.slug === categorySlug) {
				const collect = (category: CatalogCategoryNode) => {
					scope.add(category.slug);
					for (const child of category.children) {
						collect(child);
					}
				};
				collect(node);
				return true;
			}

			if (visit(node.children)) {
				return true;
			}
		}

		return false;
	};

	visit(categories);
	return scope;
}

export function deriveCatalogProductView(
	product: CatalogProductRecord,
	locale: CatalogLocale
): CatalogProductView {
	const minimumPrice = Math.min(...product.skus.map((sku) => sku.price));
	const maximumPrice = Math.max(...product.skus.map((sku) => sku.price));

	return {
		id: product.id,
		slug: product.slug,
		name: localizeValue(locale, product.name, product.nameEn),
		description: localizeValue(locale, product.description, product.descriptionEn) || null,
		categorySlug: product.categorySlug,
		minimumPrice,
		maximumPrice,
		skuCount: product.skus.length,
		representativeImage: getRepresentativeImage(product),
		product
	};
}

export function filterCatalogProducts(
	products: CatalogProductRecord[],
	categories: CatalogCategoryNode[],
	state: CatalogQueryState
): CatalogProductView[] {
	const categoryRecords = flattenCategories(categories);
	const categoryMap = new Map(categoryRecords.map((category) => [category.slug, category]));
	const normalizedQuery = normalizeSearchValue(state.query);
	const categoryScope = resolveCategorySlugScope(categories, state.categorySlug);

	const views = products
		.filter((product) => product.skus.length > 0)
		.filter((product) => {
			if (categoryScope.size === 0) {
				return state.categorySlug === null;
			}

			return categoryScope.has(product.categorySlug);
		})
		.filter((product) => {
			if (!normalizedQuery) {
				return true;
			}

			return getSearchTerms(product, categoryMap.get(product.categorySlug))
				.map(normalizeSearchValue)
				.some((term) => term.includes(normalizedQuery));
		})
		.map((product) => deriveCatalogProductView(product, state.locale));

	return sortViews(views, state.locale, state.sort);
}

function resolveDefaultSku(product: CatalogProductRecord): CatalogSkuRecord {
	const sku = product.skus[0];

	if (!sku) {
		throw new Error('A published product must include at least one SKU.');
	}

	return sku;
}

function resolveExactSku(
	product: CatalogProductRecord,
	selection: Record<string, string>
): CatalogSkuRecord | null {
	return (
		product.skus.find((sku) =>
			Object.entries(selection).every(
				([key, value]) => asAttributeText(sku.attributes[key]) === value
			)
		) ?? null
	);
}

function normalizeSelection(
	product: CatalogProductRecord,
	selection: Record<string, string>
): CatalogSkuRecord {
	const exactSku = resolveExactSku(product, selection);
	if (exactSku) {
		return exactSku;
	}

	let activeSku = resolveDefaultSku(product);
	const workingSelection = { ...activeSku.attributes, ...selection } as Record<string, string>;

	for (const [key, value] of Object.entries(selection)) {
		const exactMatch = product.skus.find((sku) =>
			Object.entries(workingSelection).every(([entryKey, entryValue]) => {
				if (entryKey === key) {
					return asAttributeText(sku.attributes[entryKey]) === value;
				}

				return asAttributeText(sku.attributes[entryKey]) === entryValue;
			})
		);

		if (exactMatch) {
			activeSku = exactMatch;
			continue;
		}

		const fallbackSku = product.skus.find((sku) => asAttributeText(sku.attributes[key]) === value);
		if (fallbackSku) {
			activeSku = fallbackSku;
			Object.assign(workingSelection, fallbackSku.attributes);
		}
	}

	return activeSku;
}

export function createProductConfigurationModel(
	product: CatalogProductRecord,
	locale: CatalogLocale,
	selection?: Record<string, string>
): ProductConfigurationModel {
	const defaultSku = resolveDefaultSku(product);
	const attributeKeys = Object.keys(defaultSku.attributes);
	const requestedSelection = selection ?? (defaultSku.attributes as Record<string, string>);
	const activeSku = normalizeSelection(product, requestedSelection);
	const selectedAttributes = attributeKeys.reduce<Record<string, string>>((accumulator, key) => {
		accumulator[key] = asAttributeText(activeSku.attributes[key]) ?? '';
		return accumulator;
	}, {});

	const optionGroups = attributeKeys.map((key) => {
		const values = [
			...new Set(product.skus.map((sku) => asAttributeText(sku.attributes[key])).filter(Boolean))
		] as string[];
		return {
			key,
			label: formatAttributeKey(locale, key),
			options: values.map((value) => {
				const available = product.skus.some((sku) =>
					attributeKeys.every((attributeKey) => {
						if (attributeKey === key) {
							return asAttributeText(sku.attributes[attributeKey]) === value;
						}

						return (
							asAttributeText(sku.attributes[attributeKey]) === selectedAttributes[attributeKey]
						);
					})
				);

				return {
					value,
					label: formatAttributeValue(locale, value),
					available,
					selected: selectedAttributes[key] === value
				};
			})
		};
	});

	return {
		activeSku,
		selectedAttributes,
		selectedAttributeEntries: attributeKeys.map((key) => ({
			key,
			label: formatAttributeKey(locale, key),
			value: selectedAttributes[key] ?? '',
			valueLabel: formatAttributeValue(locale, selectedAttributes[key] ?? '')
		})),
		attributeKeys,
		optionGroups
	};
}
