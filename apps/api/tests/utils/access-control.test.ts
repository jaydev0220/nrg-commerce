import assert from 'node:assert/strict';
import test from 'node:test';

import { parsePermissionKey, parseRoleKey } from '../../src/utils/access-control.js';

test('role and permission parsing accepts every known access-control key', () => {
	assert.equal(parseRoleKey('sales-manager'), 'sales-manager');
	assert.equal(parseRoleKey('admin'), 'admin');
	assert.equal(parsePermissionKey('order.write'), 'order.write');
});

test('role and permission parsing fails closed for unknown database values', () => {
	assert.throws(() => parseRoleKey('custom-role'), /Unsupported role key/);
	assert.throws(() => parsePermissionKey('custom.permission'), /Unsupported permission key/);
});
