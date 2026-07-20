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
	'_headers',
	'robots.txt',
	'_worker.js'
];

const robotDirectives = ['noindex', 'nofollow', 'noarchive', 'nosnippet', 'noimageindex'];

function assertRobotDirectives(content, source) {
	const normalizedContent = content.toLowerCase();
	for (const directive of robotDirectives) {
		if (!normalizedContent.includes(directive)) {
			throw new Error(`Admin ${source} does not include the ${directive} robot directive.`);
		}
	}
}

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
	if (!/<meta\s[^>]*name=["']robots["'][^>]*>/i.test(indexHtml)) {
		throw new Error('Admin SPA fallback does not include robot metadata.');
	}
	assertRobotDirectives(indexHtml, 'SPA fallback');

	const headers = await readFile(join(buildDirectory, '_headers'), 'utf8');
	if (!/^\s*X-Robots-Tag:/im.test(headers)) {
		throw new Error('Admin Cloudflare headers do not include X-Robots-Tag.');
	}
	assertRobotDirectives(headers, 'Cloudflare headers');

	const robots = await readFile(join(buildDirectory, 'robots.txt'), 'utf8');
	if (!/^\s*User-agent:\s*\*\s*$[\s\S]*^\s*Disallow:\s*\/\s*$/im.test(robots)) {
		throw new Error('Admin robots.txt does not disallow all crawlers.');
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
