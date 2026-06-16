export const permissionKeys = [
	'product.read',
	'product.create',
	'product.update',
	'product.delete',
	'product.sku.read',
	'product.sku.create',
	'product.sku.update',
	'product.sku.delete',
	'product.category.read',
	'product.category.create',
	'product.category.update',
	'product.category.delete',
	'product.image.read',
	'product.image.create',
	'product.image.delete',
	'staff.read',
	'staff.create',
	'staff.update',
	'staff.delete'
] as const;

export type PermissionKey = (typeof permissionKeys)[number];

export type PermissionDefinition = {
	key: PermissionKey;
	name: string;
	description: string;
};

export const permissionDefinitions = [
	{
		key: 'product.read',
		name: 'Read products',
		description: 'View product profiles in management workflows.'
	},
	{
		key: 'product.create',
		name: 'Create products',
		description: 'Create product profiles in management workflows.'
	},
	{
		key: 'product.update',
		name: 'Update products',
		description: 'Update product profiles in management workflows.'
	},
	{
		key: 'product.delete',
		name: 'Delete products',
		description: 'Delete product profiles in management workflows.'
	},
	{
		key: 'product.sku.read',
		name: 'Read product SKUs',
		description: 'View product SKUs in management workflows.'
	},
	{
		key: 'product.sku.create',
		name: 'Create product SKUs',
		description: 'Create product SKUs in management workflows.'
	},
	{
		key: 'product.sku.update',
		name: 'Update product SKUs',
		description: 'Update product SKUs in management workflows.'
	},
	{
		key: 'product.sku.delete',
		name: 'Delete product SKUs',
		description: 'Delete product SKUs in management workflows.'
	},
	{
		key: 'product.category.read',
		name: 'Read product categories',
		description: 'View product categories in management workflows.'
	},
	{
		key: 'product.category.create',
		name: 'Create product categories',
		description: 'Create product categories in management workflows.'
	},
	{
		key: 'product.category.update',
		name: 'Update product categories',
		description: 'Update product categories in management workflows.'
	},
	{
		key: 'product.category.delete',
		name: 'Delete product categories',
		description: 'Delete product categories in management workflows.'
	},
	{
		key: 'product.image.read',
		name: 'Read product images',
		description: 'View product images in management workflows.'
	},
	{
		key: 'product.image.create',
		name: 'Create product images',
		description: 'Create product images in management workflows.'
	},
	{
		key: 'product.image.delete',
		name: 'Delete product images',
		description: 'Delete product images in management workflows.'
	},
	{
		key: 'staff.read',
		name: 'Read staff records',
		description: 'View staff records in management workflows.'
	},
	{
		key: 'staff.create',
		name: 'Create staff records',
		description: 'Create staff records in management workflows.'
	},
	{
		key: 'staff.update',
		name: 'Update staff records',
		description: 'Update staff records in management workflows.'
	},
	{
		key: 'staff.delete',
		name: 'Delete staff records',
		description: 'Delete or deactivate staff records in management workflows.'
	}
] as const satisfies readonly PermissionDefinition[];

export const roleKeys = ['admin', 'catalog-manager', 'staff-manager'] as const;

export type RoleKey = (typeof roleKeys)[number];

export type RoleDefinition = {
	key: RoleKey;
	name: string;
	description: string;
	permissions: readonly PermissionKey[];
};

export const roleDefinitions = [
	{
		key: 'admin',
		name: 'Administrator',
		description: 'Full access across staff and product management.',
		permissions: permissionKeys
	},
	{
		key: 'catalog-manager',
		name: 'Catalog Manager',
		description: 'Manage product SKUs, categories, and images.',
		permissions: [
			'product.read',
			'product.create',
			'product.update',
			'product.delete',
			'product.sku.read',
			'product.sku.create',
			'product.sku.update',
			'product.sku.delete',
			'product.category.read',
			'product.category.create',
			'product.category.update',
			'product.category.delete',
			'product.image.read',
			'product.image.create',
			'product.image.delete'
		]
	},
	{
		key: 'staff-manager',
		name: 'Staff Manager',
		description: 'Manage staff accounts and their assigned roles.',
		permissions: ['staff.read', 'staff.create', 'staff.update', 'staff.delete']
	}
] as const satisfies readonly RoleDefinition[];
