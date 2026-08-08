import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { verifyFrontendArtifact } from '../../../scripts/ci/verify-frontend-artifact.mjs';

async function createArtifact(root, app, files) {
	const directory = join(root, 'apps', app, '.svelte-kit', 'cloudflare');
	await mkdir(directory, { recursive: true });
	for (const [name, contents] of Object.entries(files)) {
		await writeFile(join(directory, name), contents);
	}
}

test('accepts the entrypoint contract for each production frontend', async () => {
	const root = await mkdtemp(join(tmpdir(), 'nrg-frontend-artifact-'));
	const files = {
		'_worker.js': 'export default {};',
		_headers: '/*\n  X-Content-Type-Options: nosniff\n*/'
	};

	await createArtifact(root, 'admin', { ...files, 'index.html': '<!doctype html>' });
	await createArtifact(root, 'catalog', files);
	await createArtifact(root, 'landing', { ...files, 'index.html': '<!doctype html>' });

	await Promise.all(
		['admin', 'catalog', 'landing'].map((app) => verifyFrontendArtifact(app, root))
	);
});

test('reports missing files and runtime secrets without printing secret values', async () => {
	const root = await mkdtemp(join(tmpdir(), 'nrg-frontend-artifact-'));
	await assert.rejects(
		() => verifyFrontendArtifact('unknown', root),
		/Unsupported frontend app: unknown/u
	);
	await assert.rejects(
		() => verifyFrontendArtifact('landing', root),
		/artifact directory is missing: .*landing\/\.svelte-kit\/cloudflare/u
	);
	await createArtifact(root, 'catalog', {
		'_worker.js': 'const value = DATABASE_URL;',
		_headers: '/* headers */'
	});
	await createArtifact(root, 'admin', {
		'_worker.js': 'export default {};',
		_headers: '/* headers */'
	});

	await assert.rejects(
		() => verifyFrontendArtifact('catalog', root),
		(error) => {
			assert.match(error.message, /runtime secret pattern DATABASE_URL found in .*_worker\.js/u);
			assert.match(error.message, /DATABASE_URL/);
			assert.doesNotMatch(error.message, /postgres|secret-value/u);
			return true;
		}
	);

	await assert.rejects(
		() => verifyFrontendArtifact('admin', root),
		/required file is missing: index\.html/u
	);
});
