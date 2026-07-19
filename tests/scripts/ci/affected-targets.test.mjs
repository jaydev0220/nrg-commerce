import assert from 'node:assert/strict';
import test from 'node:test';

import { determineAffectedTargets } from '../../../scripts/ci/affected-targets.mjs';

test('app-only changes affect only their deployment target', () => {
	assert.deepEqual(determineAffectedTargets(['apps/landing/src/routes/+page.svelte']), {
		landing: true,
		catalog: false,
		contact: false
	});
	assert.deepEqual(determineAffectedTargets(['apps/catalog/src/routes/+page.svelte']), {
		landing: false,
		catalog: true,
		contact: false
	});
	assert.deepEqual(determineAffectedTargets(['apps/contact-worker/src/index.ts']), {
		landing: false,
		catalog: false,
		contact: true
	});
});

test('shared package changes affect each dependent deployment', () => {
	assert.deepEqual(determineAffectedTargets(['packages/components/src/lib/Navbar.svelte']), {
		landing: true,
		catalog: true,
		contact: false
	});
	assert.deepEqual(determineAffectedTargets(['packages/schemas/src/common.ts']), {
		landing: true,
		catalog: true,
		contact: true
	});
});

test('root tooling changes affect all deployment targets', () => {
	for (const path of [
		'package.json',
		'pnpm-lock.yaml',
		'pnpm-workspace.yaml',
		'.github/workflows/ci-deploy.yml',
		'scripts/ci/verify-landing-build.mjs'
	]) {
		assert.deepEqual(determineAffectedTargets([path]), {
			landing: true,
			catalog: true,
			contact: true
		});
	}
});

test('unrelated local application changes do not trigger production deployment', () => {
	assert.deepEqual(determineAffectedTargets(['apps/admin/src/routes/+page.svelte']), {
		landing: false,
		catalog: false,
		contact: false
	});
});

test('manual targets override changed paths', () => {
	assert.deepEqual(determineAffectedTargets([], 'all'), {
		landing: true,
		catalog: true,
		contact: true
	});
	assert.deepEqual(determineAffectedTargets([], 'catalog'), {
		landing: false,
		catalog: true,
		contact: false
	});
});
