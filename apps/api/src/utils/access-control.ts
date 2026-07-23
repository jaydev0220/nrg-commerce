import { permissionKeys, roleKeys, type PermissionKey, type RoleKey } from '@packages/database';

export function parseRoleKey(value: string): RoleKey {
	if ((roleKeys as readonly string[]).includes(value)) return value as RoleKey;
	throw new Error('Unsupported role key in database.');
}

export function parsePermissionKey(value: string): PermissionKey {
	if ((permissionKeys as readonly string[]).includes(value)) return value as PermissionKey;
	throw new Error('Unsupported permission key in database.');
}
