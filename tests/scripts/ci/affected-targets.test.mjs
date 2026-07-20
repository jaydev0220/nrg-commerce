import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import {
	determineAffectedTargets,
	readChangedPaths
} from '../../../scripts/ci/affected-targets.mjs';

test('changed paths are read from a text stream', async () => {
	const paths = await readChangedPaths(
		Readable.from(['apps/catalog/src/routes/+page.svelte\n', 'packages/seo/src/index.ts\n'])
	);

	assert.deepEqual(paths, [
		'apps/catalog/src/routes/+page.svelte',
		'packages/seo/src/index.ts',
		''
	]);
});

test('app-only changes affect only their deployment target', () => {
	assert.deepEqual(determineAffectedTargets(['apps/landing/src/routes/+page.svelte']), {
		landing: true,
		catalog: false,
		contact: false,
		admin: false
	});
	assert.deepEqual(determineAffectedTargets(['apps/catalog/src/routes/+page.svelte']), {
		landing: false,
		catalog: true,
		contact: false,
		admin: false
	});
	assert.deepEqual(determineAffectedTargets(['apps/contact-worker/src/index.ts']), {
		landing: false,
		catalog: false,
		contact: true,
		admin: false
	});
	assert.deepEqual(determineAffectedTargets(['apps/admin/src/routes/+page.svelte']), {
		landing: false,
		catalog: false,
		contact: false,
		admin: true
	});
});

test('shared package changes affect each dependent deployment', () => {
	assert.deepEqual(determineAffectedTargets(['packages/components/src/lib/Navbar.svelte']), {
		landing: true,
		catalog: true,
		contact: false,
		admin: false
	});
	assert.deepEqual(determineAffectedTargets(['packages/schemas/src/common.ts']), {
		landing: true,
		catalog: true,
		contact: true,
		admin: true
	});
	assert.deepEqual(determineAffectedTargets(['packages/styles/shared.css']), {
		landing: true,
		catalog: true,
		contact: false,
		admin: true
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
			contact: true,
			admin: true
		});
	}
});

test('unrelated local application changes do not trigger production deployment', () => {
	assert.deepEqual(determineAffectedTargets(['apps/api/src/routes/index.ts']), {
		landing: false,
		catalog: false,
		contact: false,
		admin: false
	});
});

test('manual targets override changed paths', () => {
	assert.deepEqual(determineAffectedTargets([], 'all'), {
		landing: true,
		catalog: true,
		contact: true,
		admin: true
	});
	assert.deepEqual(determineAffectedTargets([], 'catalog'), {
		landing: false,
		catalog: true,
		contact: false,
		admin: false
	});
	assert.deepEqual(determineAffectedTargets([], 'admin'), {
		landing: false,
		catalog: false,
		contact: false,
		admin: true
	});
});
