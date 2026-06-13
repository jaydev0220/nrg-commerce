import type {
	CatalogCategoryRecord,
	CatalogCategoryTreeRecord,
	CatalogJsonValue
} from '../types/catalog.js';

function isObject(value: CatalogJsonValue | undefined): value is Record<string, CatalogJsonValue> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function matchesJsonValue(
	actual: CatalogJsonValue | undefined,
	expected: CatalogJsonValue | undefined
): boolean {
	if (expected === undefined) {
		return actual === undefined;
	}

	if (Array.isArray(expected)) {
		if (!Array.isArray(actual) || actual.length !== expected.length) {
			return false;
		}

		return expected.every((expectedValue, index) => matchesJsonValue(actual[index], expectedValue));
	}

	if (isObject(expected)) {
		if (!isObject(actual)) {
			return false;
		}

		return Object.entries(expected).every(([key, expectedValue]) =>
			matchesJsonValue(actual[key], expectedValue)
		);
	}

	return actual === expected;
}

export function matchesAttributes(
	attributes: Record<string, CatalogJsonValue>,
	filters: Record<string, CatalogJsonValue>
): boolean {
	return Object.entries(filters).every(([key, expectedValue]) =>
		matchesJsonValue(attributes[key], expectedValue)
	);
}

export function buildCategoryTree(
	categories: CatalogCategoryRecord[],
	productCounts?: Record<string, number>
): CatalogCategoryTreeRecord[] {
	const nodes = new Map<string, CatalogCategoryTreeRecord>();

	for (const category of categories) {
		nodes.set(category.id, {
			...category,
			productCount: productCounts?.[category.id],
			children: []
		});
	}

	const roots: CatalogCategoryTreeRecord[] = [];

	for (const node of nodes.values()) {
		if (node.parentId) {
			const parent = nodes.get(node.parentId);

			if (parent) {
				parent.children.push(node);
				continue;
			}
		}

		roots.push(node);
	}

	return roots;
}
