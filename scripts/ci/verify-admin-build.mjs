import { access, readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

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

async function listFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map((entry) => {
			const path = join(directory, entry.name);
			return entry.isDirectory() ? listFiles(path) : [path];
		})
	);
	return nested.flat();
}

export async function verifyAdminBuild(buildDirectory, expectedApiBaseUrl) {
	await Promise.all(expectedFiles.map((path) => access(join(buildDirectory, path))));

	const indexHtml = await readFile(join(buildDirectory, 'index.html'), 'utf8');
	if (!indexHtml.includes('/_app/immutable/entry/start.')) {
		throw new Error('Admin SPA fallback does not load the SvelteKit client entry.');
	}

	const files = await listFiles(buildDirectory);
	const scripts = files.filter((path) => {
		const outputPath = relative(buildDirectory, path);
		return outputPath.startsWith('_app/immutable/') && outputPath.endsWith('.js');
	});
	const scriptSources = await Promise.all(scripts.map((path) => readFile(path, 'utf8')));
	if (!scriptSources.some((source) => source.includes(expectedApiBaseUrl))) {
		throw new Error('Admin client bundle does not contain the expected API base URL.');
	}

	return {
		files: [...expectedFiles],
		scriptCount: scripts.length
	};
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const buildDirectory = process.argv[2];
	const expectedApiBaseUrl = process.argv[3];
	if (!buildDirectory || !expectedApiBaseUrl) {
		throw new Error('Usage: verify-admin-build.mjs <build-directory> <expected-api-base-url>');
	}

	const result = await verifyAdminBuild(buildDirectory, expectedApiBaseUrl);
	process.stdout.write(
		`Verified ${result.files.length} admin artifacts and ${result.scriptCount} scripts.\n`
	);
}
