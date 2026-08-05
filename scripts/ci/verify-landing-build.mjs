import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const expectedPages = [
	'index.html',
	'about/index.html',
	'contact/index.html',
	'en/index.html',
	'en/about/index.html',
	'en/contact/index.html'
];
const limits = {
	javascriptFiles: 19,
	totalJavascriptBytes: 180 * 1024,
	modulePreloadsPerPage: 15,
	referencedJavascriptBytesPerPage: 165 * 1024,
	inlineScriptsPerPage: 2
};
const serverOnlyAssets = ['_worker.js', '_routes.json', '_headers', '_redirects'];
const securityHeaderPatterns = [
	[/^\s*Content-Security-Policy:.*frame-ancestors\s+'none'/im, 'frame-ancestors CSP'],
	[/^\s*Cross-Origin-Opener-Policy:\s*same-origin\s*$/im, 'Cross-Origin-Opener-Policy'],
	[/^\s*Permissions-Policy:/im, 'Permissions-Policy'],
	[/^\s*Referrer-Policy:\s*strict-origin-when-cross-origin\s*$/im, 'Referrer-Policy'],
	[
		/^\s*Strict-Transport-Security:\s*max-age=31536000;\s*includeSubDomains\s*$/im,
		'Strict-Transport-Security'
	],
	[/^\s*X-Content-Type-Options:\s*nosniff\s*$/im, 'X-Content-Type-Options'],
	[/^\s*X-Frame-Options:\s*DENY\s*$/im, 'X-Frame-Options']
];

async function assertServerAssetsExcluded(root) {
	const ignoredAssets = new Set(
		(await readFile(resolve(root, '.assetsignore'), 'utf8')).split(/\r?\n/u).filter(Boolean)
	);

	for (const asset of serverOnlyAssets) {
		if (!ignoredAssets.has(asset)) {
			throw new Error(`Landing build must exclude ${asset} from static asset uploads.`);
		}
	}
}

async function assertSecurityHeaders(root) {
	const headers = await readFile(resolve(root, '_headers'), 'utf8');
	for (const [pattern, label] of securityHeaderPatterns) {
		if (!pattern.test(headers)) {
			throw new Error(`Landing Cloudflare headers do not include ${label}.`);
		}
	}
}

async function assertSiteDiscoveryFiles(root, expectedSiteOrigin) {
	const robots = await readFile(resolve(root, 'robots.txt'), 'utf8');
	const sitemap = await readFile(resolve(root, 'sitemap.xml'), 'utf8');
	const llms = await readFile(resolve(root, 'llms.txt'), 'utf8');
	const sitemapUrl = new URL('/sitemap.xml', expectedSiteOrigin).toString();

	if (!robots.includes('User-agent: *') || !robots.includes(`Sitemap: ${sitemapUrl}`)) {
		throw new Error('Landing robots.txt must allow crawling and reference the canonical sitemap.');
	}
	if ((sitemap.match(/<loc>/g) ?? []).length !== 6 || !sitemap.includes('hreflang="x-default"')) {
		throw new Error('Landing sitemap must contain all six localized page URLs and alternates.');
	}
	if (!llms.includes('# NRG Glass') || !llms.includes(sitemapUrl)) {
		throw new Error('Landing llms.txt must identify the site and reference the canonical sitemap.');
	}
}

function assertCanonicalMetadata(html, page, expectedSiteOrigin) {
	const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/iu)?.[0];
	const canonicalHref = canonical?.match(/\bhref=["']([^"']+)["']/iu)?.[1];
	if (!canonicalHref) throw new Error(`${page} must contain a canonical link.`);

	const expectedPath = page === 'index.html' ? '/' : `/${page.replace(/\/index\.html$/u, '')}/`;
	const expectedUrl = new URL(expectedPath, expectedSiteOrigin).toString();
	if (canonicalHref !== expectedUrl) {
		throw new Error(`${page} canonical URL must be ${expectedUrl}.`);
	}
}

async function listJavascriptFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true, recursive: true });
	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
		.map((entry) => resolve(entry.parentPath, entry.name));
}

function assertWithin(value, maximum, description) {
	if (value > maximum) throw new Error(`Landing build exceeds ${description}: ${value}.`);
}

function pageAssetReferences(html) {
	const links = html.match(/<link\b[^>]*\brel=["']modulepreload["'][^>]*>/gi) ?? [];
	return links.flatMap((link) => {
		const match = link.match(/\bhref=["']([^"']+\.js)["']/i);
		return match?.[1] ? [match[1]] : [];
	});
}

function hasRenderedHeading(html) {
	const content = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
	if (!content) return false;

	return (
		content
			.replace(/<!--[\s\S]*?-->/g, '')
			.replace(/<[^>]+>/g, '')
			.trim().length > 0
	);
}

function readCspMeta(html, page) {
	const tag = html.match(/<meta\b[^>]*\bhttp-equiv=["']content-security-policy["'][^>]*>/iu)?.[0];
	const content = tag?.match(/\bcontent="([^"]+)"/iu)?.[1];
	if (!content) throw new Error(`${page} must contain a Content Security Policy.`);
	return content;
}

function assertResourcePolicy(csp, page, expectedContactWorkerUrl) {
	const contactOrigin = new URL(expectedContactWorkerUrl).origin;
	for (const requirement of [
		"default-src 'self'",
		"object-src 'none'",
		"script-src-attr 'none'",
		'https://challenges.cloudflare.com',
		contactOrigin
	]) {
		if (!csp.includes(requirement)) {
			throw new Error(`${page} Content Security Policy does not include ${requirement}.`);
		}
	}
	const scriptSource = csp.match(/(?:^|;\s*)script-src\s+([^;]+)/u)?.[1] ?? '';
	if (!/'sha256-[^']+'/u.test(scriptSource) || scriptSource.includes("'unsafe-inline'")) {
		throw new Error(`${page} Content Security Policy must hash inline scripts.`);
	}
}

export async function verifyLandingBuild(
	buildDirectory,
	expectedContactWorkerUrl,
	expectedSiteOrigin = undefined
) {
	const root = resolve(buildDirectory);
	await assertServerAssetsExcluded(root);
	await assertSecurityHeaders(root);
	if (expectedSiteOrigin) await assertSiteDiscoveryFiles(root, expectedSiteOrigin);
	const javascriptFiles = await listJavascriptFiles(resolve(root, '_app', 'immutable'));
	const totalJavascriptBytes = (
		await Promise.all(javascriptFiles.map(async (file) => (await stat(file)).size))
	).reduce((total, size) => total + size, 0);

	assertWithin(javascriptFiles.length, limits.javascriptFiles, '19 JavaScript files');
	assertWithin(totalJavascriptBytes, limits.totalJavascriptBytes, '180 KiB of JavaScript');

	for (const page of expectedPages) {
		const pagePath = resolve(root, page);
		const html = await readFile(pagePath, 'utf8');
		if (!/<main\b[^>]*\bid=["']main-content["'][^>]*>/i.test(html) || !hasRenderedHeading(html)) {
			throw new Error(`${page} must contain prerendered main content and a rendered heading.`);
		}
		if (expectedSiteOrigin) assertCanonicalMetadata(html, page, expectedSiteOrigin);
		assertResourcePolicy(readCspMeta(html, page), page, expectedContactWorkerUrl);

		const references = [...new Set(pageAssetReferences(html))];
		assertWithin(references.length, limits.modulePreloadsPerPage, '15 module preloads per page');

		const referencedJavascriptBytes = (
			await Promise.all(
				references.map(async (reference) => {
					const file = resolve(dirname(pagePath), reference);
					if (!file.startsWith(`${root}/`))
						throw new Error(`${page} references JavaScript outside its build.`);
					return (await stat(file)).size;
				})
			)
		).reduce((total, size) => total + size, 0);
		assertWithin(
			referencedJavascriptBytes,
			limits.referencedJavascriptBytesPerPage,
			'165 KiB of referenced JavaScript per page'
		);

		const inlineScripts = (html.match(/<script\b(?![^>]*\bsrc=)[^>]*>/gi) ?? []).filter(
			(tag) => !/\btype=["']application\/ld\+json["']/i.test(tag)
		).length;
		assertWithin(inlineScripts, limits.inlineScriptsPerPage, '2 inline scripts per page');
	}

	return {
		pageCount: expectedPages.length,
		javascriptFileCount: javascriptFiles.length,
		totalJavascriptBytes
	};
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const buildDirectory = process.argv[2] ?? 'apps/landing/.svelte-kit/cloudflare';
	const expectedContactWorkerUrl = process.argv[3];
	const expectedSiteOrigin = process.argv[4];
	if (!expectedContactWorkerUrl || !expectedSiteOrigin) {
		throw new Error(
			'Usage: verify-landing-build.mjs <build-directory> <expected-contact-worker-url> <expected-site-origin>'
		);
	}
	const result = await verifyLandingBuild(
		buildDirectory,
		expectedContactWorkerUrl,
		expectedSiteOrigin
	);
	process.stdout.write(
		`Verified ${result.pageCount} pages and ${result.javascriptFileCount} JavaScript files (${result.totalJavascriptBytes} bytes).\n`
	);
}
