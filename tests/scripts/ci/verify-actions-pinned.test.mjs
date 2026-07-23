import assert from 'node:assert/strict';
import test from 'node:test';

import { findMutableActionReferences } from '../../../scripts/ci/verify-actions-pinned.mjs';

test('accepts full commit SHAs and local actions', () => {
	const source = `
steps:
  - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
  - uses: ./actions/deploy
`;

	assert.deepEqual(findMutableActionReferences(source), []);
});

test('reports mutable action references with line numbers', () => {
	const source = `
steps:
  - uses: actions/checkout@v6
  - uses: docker/build-push-action@main # mutable
`;

	assert.deepEqual(findMutableActionReferences(source), [
		{ action: 'actions/checkout', line: 3, reference: 'v6' },
		{ action: 'docker/build-push-action', line: 4, reference: 'main' }
	]);
});
