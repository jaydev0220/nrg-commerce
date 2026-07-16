import { describe, expect, it } from 'vitest';

import {
	buildCategoryTree,
	collectDescendantIds,
	createCategorySlug,
	filterCategoryTree
} from './category-tree';

const category = (id: string, name: string, parentId: string | null, position = 0) => ({
	id,
	name,
	nameEn: name,
	slug: name.toLowerCase(),
	description: null,
	descriptionEn: null,
	position,
	parentId,
	deletedAt: null,
	createdAt: new Date(),
	updatedAt: new Date()
});

describe('category tree helpers', () => {
	it('builds and sorts nested categories', () => {
		const tree = buildCategoryTree([
			category('child', 'Child', 'root', 1),
			category('root', 'Root', null, 0),
			category('first', 'First', 'root', 0)
		]);

		expect(tree.map((node) => node.id)).toEqual(['root']);
		expect(tree[0]?.children.map((node) => node.id)).toEqual(['first', 'child']);
	});

	it('keeps matching descendants with their ancestor path', () => {
		const tree = buildCategoryTree([
			category('root', 'Root', null),
			category('child', 'Child', 'root'),
			category('other', 'Other', 'root')
		]);

		const filtered = filterCategoryTree(tree, 'child');
		expect(filtered.map((node) => node.id)).toEqual(['root']);
		expect(filtered[0]?.children.map((node) => node.id)).toEqual(['child']);
	});

	it('collects descendants for parent selection and generates English slugs', () => {
		const [root] = buildCategoryTree([
			category('root', 'Root', null),
			category('child', 'Child', 'root'),
			category('grandchild', 'Grandchild', 'child')
		]);

		expect([...collectDescendantIds(root!)]).toEqual(['root', 'child', 'grandchild']);
		expect(createCategorySlug('Cooling Parts & Tools')).toBe('cooling-parts-tools');
		expect(createCategorySlug('散熱器')).toBe('');
	});
});
