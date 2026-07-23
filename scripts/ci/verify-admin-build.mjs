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
const securityHeaderPatterns = [
	[/^\s*Content-Security-Policy:.*frame-ancestors\s+'none'/im, 'frame-ancestors CSP'],
	[/^\s*Permissions-Policy:/im, 'Permissions-Policy'],
	[/^\s*Referrer-Policy:\s*no-referrer\s*$/im, 'Referrer-Policy'],
	[/^\s*X-Content-Type-Options:\s*nosniff\s*$/im, 'X-Content-Type-Options'],
	[/^\s*X-Frame-Options:\s*DENY\s*$/im, 'X-Frame-Options']
];

function assertRobotDirectives(content, source) {
	const normalizedContent = content.toLowerCase();
	for (const directive of robotDirectives) {
		if (!normalizedContent.includes(directive)) {
			throw new Error(`Admin ${source} does not include the ${directive} robot directive.`);
		}
	}
}

function readCspMeta(html) {
	const tag = html.match(/<meta\b[^>]*\bhttp-equiv=["']content-security-policy["'][^>]*>/iu)?.[0];
	const content = tag?.match(/\bcontent="([^"]+)"/iu)?.[1];
	if (!content) throw new Error('Admin SPA fallback does not include a Content Security Policy.');
	return content;
}

function assertResourcePolicy(csp, expectedApiBaseUrl) {
	const expectedApiOrigin = new URL(expectedApiBaseUrl).origin;
	for (const requirement of ["default-src 'self'", "object-src 'none'", "script-src-attr 'none'"]) {
		if (!csp.includes(requirement)) {
			throw new Error(`Admin Content Security Policy does not include ${requirement}.`);
		}
	}
	if (!csp.includes(`connect-src 'self' ${expectedApiOrigin}`)) {
		throw new Error('Admin Content Security Policy does not include the expected API base URL.');
	}
	const scriptSource = csp.match(/(?:^|;\s*)script-src\s+([^;]+)/u)?.[1] ?? '';
	if (!/'sha256-[^']+'/u.test(scriptSource) || scriptSource.includes("'unsafe-inline'")) {
		throw new Error('Admin Content Security Policy must hash inline scripts.');
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
	assertResourcePolicy(readCspMeta(indexHtml), expectedApiBaseUrl);

	const headers = await readFile(join(buildDirectory, '_headers'), 'utf8');
	if (!/^\s*X-Robots-Tag:/im.test(headers)) {
		throw new Error('Admin Cloudflare headers do not include X-Robots-Tag.');
	}
	assertRobotDirectives(headers, 'Cloudflare headers');
	for (const [pattern, label] of securityHeaderPatterns) {
		if (!pattern.test(headers)) {
			throw new Error(`Admin Cloudflare headers do not include ${label}.`);
		}
	}

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
