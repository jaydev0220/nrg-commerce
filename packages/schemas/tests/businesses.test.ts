import assert from 'node:assert/strict';
import test from 'node:test';

import {
	businessCreateSchema,
	businessLabelCreateSchema,
	businessListQuerySchema
} from '../src/index.js';

test('business request schemas reject oversized persisted and query text', () => {
	assert.throws(() => businessCreateSchema.parse({ name: 'a'.repeat(201) }));
	assert.throws(() => businessCreateSchema.parse({ name: 'Business', address: 'a'.repeat(1_001) }));
	assert.throws(() => businessLabelCreateSchema.parse({ name: 'a'.repeat(101), color: '#123456' }));
	assert.throws(() => businessListQuerySchema.parse({ search: 'a'.repeat(201) }));
});
