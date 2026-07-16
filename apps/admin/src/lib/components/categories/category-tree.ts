import type { ManagedCategory } from '$lib/api/admin-api';

export type CategoryNode = ManagedCategory & {
	children: CategoryNode[];
};

export type CategoryListEntry = {
	category: CategoryNode;
	depth: number;
};

function compareCategories(left: ManagedCategory, right: ManagedCategory): number {
	return left.position - right.position || left.name.localeCompare(right.name, 'zh-TW');
}

export function buildCategoryTree(categories: ManagedCategory[]): CategoryNode[] {
	const nodes = new Map<string, CategoryNode>(
		categories.map((category) => [category.id, { ...category, children: [] }])
	);
	const roots: CategoryNode[] = [];

	for (const node of nodes.values()) {
		const parent = node.parentId ? nodes.get(node.parentId) : undefined;
		if (parent) {
			parent.children.push(node);
		} else {
			roots.push(node);
		}
	}

	const sortBranch = (branch: CategoryNode[]) => {
		branch.sort(compareCategories);
		for (const node of branch) sortBranch(node.children);
	};
	sortBranch(roots);

	return roots;
}

function normalizeSearch(value: string): string {
	return value.trim().toLocaleLowerCase('zh-TW');
}

function matchesCategory(category: ManagedCategory, query: string): boolean {
	return [category.name, category.nameEn ?? '', category.slug].some((value) =>
		normalizeSearch(value).includes(query)
	);
}

export function filterCategoryTree(nodes: CategoryNode[], search: string): CategoryNode[] {
	const query = normalizeSearch(search);
	if (!query) return nodes;

	return nodes.flatMap((node) => {
		const children = filterCategoryTree(node.children, query);
		if (!matchesCategory(node, query) && children.length === 0) return [];
		return [{ ...node, children }];
	});
}

export function flattenCategoryTree(nodes: CategoryNode[], depth = 0): CategoryListEntry[] {
	return nodes.flatMap((category) => [
		{ category, depth },
		...flattenCategoryTree(category.children, depth + 1)
	]);
}

export function collectDescendantIds(category: CategoryNode): Set<string> {
	return new Set([
		category.id,
		...category.children.flatMap((child) => [...collectDescendantIds(child)])
	]);
}

export function createCategorySlug(nameEn: string): string {
	return nameEn
		.trim()
		.toLocaleLowerCase('en-US')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function replaceCategoryChildren(
	nodes: CategoryNode[],
	parentId: string | null,
	children: CategoryNode[]
): CategoryNode[] {
	if (parentId === null) return children;

	return nodes.map((node) =>
		node.id === parentId
			? { ...node, children }
			: { ...node, children: replaceCategoryChildren(node.children, parentId, children) }
	);
}
