import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { verifyLandingBuild } from '../../../scripts/ci/verify-landing-build.mjs';

const expectedContactWorkerUrl = 'https://contact.example.test';
const cspMeta = `<meta http-equiv="content-security-policy" content="default-src 'self'; connect-src 'self' ${expectedContactWorkerUrl} https://challenges.cloudflare.com; object-src 'none'; script-src 'self' https://challenges.cloudflare.com 'sha256-example'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'">`;

async function createBuild(options = {}) {
	const root = await mkdtemp(join(tmpdir(), 'landing-build-'));
	const assets = join(root, '_app', 'immutable');
	await mkdir(assets, { recursive: true });
	await writeFile(
		join(root, '.assetsignore'),
		options.assetsIgnore ?? '\n_worker.js\n_routes.json\n_headers\n_redirects\n'
	);
	const scriptNames = options.scriptNames ?? ['app.js'];
	for (const scriptName of scriptNames) {
		await writeFile(join(assets, scriptName), options.scriptContent ?? 'export {};');
	}

	for (const page of [
		'index.html',
		'about/index.html',
		'contact/index.html',
		'en/index.html',
		'en/about/index.html',
		'en/contact/index.html'
	]) {
		await mkdir(join(root, ...page.split('/').slice(0, -1)), { recursive: true });
		const assetPrefix = '../'.repeat(page.split('/').length - 1) || './';
		const modulePreloads = scriptNames
			.map((name) => `<link rel="modulepreload" href="${assetPrefix}_app/immutable/${name}">`)
			.join('');
		const html = `${modulePreloads}<main id="main-content"><h1>Rendered page</h1></main><script>start()</script>`;
		await writeFile(
			join(root, page),
			`${options.includeCsp === false ? '' : cspMeta}${options.html ?? html}`
		);
	}
	return root;
}

test('accepts rendered static pages within the JavaScript budgets', async () => {
	const root = await createBuild();
	const result = await verifyLandingBuild(root, expectedContactWorkerUrl);

	assert.equal(result.pageCount, 6);
	assert.equal(result.javascriptFileCount, 1);
});

test('rejects a build that can upload the generated Worker entry point as an asset', async () => {
	const root = await createBuild({ assetsIgnore: '_routes.json\n_headers\n_redirects\n' });

	await assert.rejects(
		() => verifyLandingBuild(root, expectedContactWorkerUrl),
		/must exclude _worker\.js/u
	);
});

test('rejects a build without every localized route', async () => {
	const root = await createBuild();
	await rm(join(root, 'en', 'contact', 'index.html'));

	await assert.rejects(
		() => verifyLandingBuild(root, expectedContactWorkerUrl),
		/en\/contact\/index\.html/
	);
});

test('accepts visible heading text wrapped in Svelte markers and nested markup', async () => {
	const root = await createBuild({
		html: '<main id="main-content"><h1><!--[--><!--[0-->Rendered<br>page<!--]--><!--]--></h1></main>'
	});

	await assert.doesNotReject(() => verifyLandingBuild(root, expectedContactWorkerUrl));
});

test('does not count JSON-LD structured data as executable inline JavaScript', async () => {
	const root = await createBuild({
		html: '<main id="main-content"><h1>Rendered page</h1></main><script>a()</script><script type="application/ld+json">{}</script><script>b()</script>'
	});

	await assert.doesNotReject(() => verifyLandingBuild(root, expectedContactWorkerUrl));
});

test('rejects missing or empty prerendered content', async () => {
	const root = await createBuild({ html: '<main id="main-content"></main>' });

	await assert.rejects(
		() => verifyLandingBuild(root, expectedContactWorkerUrl),
		/rendered heading/
	);
});

test('rejects JavaScript file and byte budget regressions', async () => {
	const tooManyFiles = await createBuild({
		scriptNames: Array.from({ length: 20 }, (_, index) => `chunk-${index}.js`)
	});
	await assert.rejects(
		() => verifyLandingBuild(tooManyFiles, expectedContactWorkerUrl),
		/19 JavaScript files/
	);

	const tooManyBytes = await createBuild({ scriptContent: 'x'.repeat(180 * 1024 + 1) });
	await assert.rejects(() => verifyLandingBuild(tooManyBytes, expectedContactWorkerUrl), /180 KiB/);
});

test('rejects per-page preload, referenced byte, and inline script regressions', async () => {
	const scriptNames = Array.from({ length: 16 }, (_, index) => `chunk-${index}.js`);
	const tooManyPreloads = await createBuild({ scriptNames });
	await assert.rejects(
		() => verifyLandingBuild(tooManyPreloads, expectedContactWorkerUrl),
		/15 module preloads/
	);

	const tooManyReferencedBytes = await createBuild({ scriptContent: 'x'.repeat(165 * 1024 + 1) });
	await assert.rejects(
		() => verifyLandingBuild(tooManyReferencedBytes, expectedContactWorkerUrl),
		/165 KiB/
	);

	const tooManyInlineScripts = await createBuild({
		html: '<main id="main-content"><h1>Rendered page</h1></main><script>a()</script><script>b()</script><script>c()</script>'
	});
	await assert.rejects(
		() => verifyLandingBuild(tooManyInlineScripts, expectedContactWorkerUrl),
		/2 inline scripts/
	);
});

test('rejects pages without a strict resource policy', async () => {
	const root = await createBuild({ includeCsp: false });

	await assert.rejects(
		() => verifyLandingBuild(root, expectedContactWorkerUrl),
		/Content Security Policy/u
	);
});
