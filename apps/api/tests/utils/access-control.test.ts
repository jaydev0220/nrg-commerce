import assert from 'node:assert/strict';
import test from 'node:test';

import { parsePermissionKey, parseRoleKey } from '../../src/utils/access-control.js';

test('role and permission parsing accepts every known access-control key', () => {
	assert.equal(parseRoleKey('admin'), 'admin');
	assert.equal(parseRoleKey('read-only-admin'), 'read-only-admin');
	assert.equal(parseRoleKey('read-only'), 'read-only');
	assert.equal(parseRoleKey('business-manager'), 'business-manager');
	assert.equal(parseRoleKey('order-manager'), 'order-manager');
	assert.equal(parseRoleKey('product-manager'), 'product-manager');
	assert.equal(parsePermissionKey('order.write'), 'order.write');
});

test('role and permission parsing fails closed for unknown database values', () => {
	assert.throws(() => parseRoleKey('custom-role'), /Unsupported role key/);
	assert.throws(() => parseRoleKey('catalog-manager'), /Unsupported role key/);
	assert.throws(() => parseRoleKey('staff-manager'), /Unsupported role key/);
	assert.throws(() => parseRoleKey('sales-manager'), /Unsupported role key/);
	assert.throws(() => parsePermissionKey('custom.permission'), /Unsupported permission key/);
});
