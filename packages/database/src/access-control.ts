export const permissionKeys = [
	'business.read',
	'business.write',
	'order.read',
	'order.write',
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
	'product.image.update',
	'product.image.delete',
	'log.read',
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
		key: 'business.read',
		name: 'Read businesses',
		description: 'View business records in management workflows.'
	},
	{
		key: 'business.write',
		name: 'Write businesses',
		description: 'Create, update, delete, and restore business records in management workflows.'
	},
	{
		key: 'order.read',
		name: 'Read orders',
		description: 'View order records in management workflows.'
	},
	{
		key: 'order.write',
		name: 'Write orders',
		description: 'Create orders and update order status in management workflows.'
	},
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
		key: 'product.image.update',
		name: 'Update product images',
		description: 'Update product image focus points in management workflows.'
	},
	{
		key: 'product.image.delete',
		name: 'Delete product images',
		description: 'Delete product images in management workflows.'
	},
	{
		key: 'log.read',
		name: 'Read logs',
		description: 'View audit and request logs in management workflows.'
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

export const roleKeys = [
	'admin',
	'read-only-admin',
	'read-only',
	'business-manager',
	'order-manager',
	'product-manager'
] as const;

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
		name: '管理員',
		description: '擁有所有權限',
		permissions: permissionKeys
	},
	{
		key: 'read-only-admin',
		name: '唯讀 (含內部管理)',
		description: '可以查看所有資料，但無法修改 (包含內部管理資料)',
		permissions: permissionKeys.filter((key) => key.endsWith('.read'))
	},
	{
		key: 'read-only',
		name: '唯讀',
		description: '可以查看所有資料，但無法修改',
		permissions: permissionKeys.filter(
			(key) => key.endsWith('.read') && !key.startsWith('log') && !key.startsWith('staff')
		)
	},
	{
		key: 'business-manager',
		name: '企業管理',
		description: '可以管理企業資料',
		permissions: permissionKeys.filter((key) => key.startsWith('business.'))
	},
	{
		key: 'order-manager',
		name: '訂單管理',
		description: '可以管理訂單資料',
		permissions: permissionKeys.filter((key) => key.startsWith('order.'))
	},
	{
		key: 'product-manager',
		name: '產品管理',
		description: '可以管理產品資料',
		permissions: permissionKeys.filter((key) => key.startsWith('product.'))
	}
] as const satisfies readonly RoleDefinition[];
