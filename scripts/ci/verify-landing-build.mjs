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

export async function verifyLandingBuild(buildDirectory) {
	const root = resolve(buildDirectory);
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
	const result = await verifyLandingBuild(process.argv[2] ?? 'apps/landing/build');
	process.stdout.write(
		`Verified ${result.pageCount} pages and ${result.javascriptFileCount} JavaScript files (${result.totalJavascriptBytes} bytes).\n`
	);
}
