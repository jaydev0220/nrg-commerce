import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { verifyAdminBuild } from '../../../scripts/ci/verify-admin-build.mjs';

const expectedFiles = [
	'index.html',
	'businesses.html',
	'login.html',
	'login/setup.html',
	'login/verify.html',
	'logs.html',
	'orders.html',
	'products.html',
	'products/categories.html',
	'settings.html',
	'staff.html',
	'_worker.js'
];

async function createBuild() {
	const directory = await mkdtemp(join(tmpdir(), 'admin-build-'));
	for (const path of expectedFiles) {
		const outputPath = join(directory, path);
		await mkdir(dirname(outputPath), { recursive: true });
		const content =
			path === 'index.html'
				? '<script type="module" src="/_app/immutable/entry/start.example.js"></script>'
				: '';
		await writeFile(outputPath, content);
	}
	await mkdir(join(directory, '_app/immutable/chunks'), { recursive: true });
	await writeFile(
		join(directory, '_app/immutable/chunks/config.js'),
		'export const api = "https://api.example.test";'
	);
	return directory;
}

test('accepts a complete admin SPA build', async () => {
	const directory = await createBuild();
	const result = await verifyAdminBuild(directory, 'https://api.example.test');

	assert.equal(result.files.length, expectedFiles.length);
	assert.equal(result.scriptCount, 1);
});

test('rejects a build without a fixed route shell', async () => {
	const directory = await createBuild();
	await assert.rejects(
		verifyAdminBuild(join(directory, 'missing'), 'https://api.example.test'),
		/ENOENT/
	);
});

test('rejects a build with the wrong API base URL', async () => {
	const directory = await createBuild();
	await assert.rejects(
		verifyAdminBuild(directory, 'https://other-api.example.test'),
		/expected API base URL/
	);
});
