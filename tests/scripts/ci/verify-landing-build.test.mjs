import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { verifyLandingBuild } from '../../../scripts/ci/verify-landing-build.mjs';

async function createBuild(options = {}) {
	const root = await mkdtemp(join(tmpdir(), 'landing-build-'));
	const assets = join(root, '_app', 'immutable');
	await mkdir(assets, { recursive: true });
	const scriptNames = options.scriptNames ?? ['app.js'];
	for (const scriptName of scriptNames) {
		await writeFile(join(assets, scriptName), options.scriptContent ?? 'export {};');
	}

	const modulePreloads = scriptNames
		.map((name) => `<link rel="modulepreload" href="./_app/immutable/${name}">`)
		.join('');
	const html = `${modulePreloads}<main id="main-content"><h1>Rendered page</h1></main><script>start()</script>`;
	for (const page of ['index.html', 'about.html', 'contact.html']) {
		await writeFile(join(root, page), options.html ?? html);
	}
	return root;
}

test('accepts rendered static pages within the JavaScript budgets', async () => {
	const root = await createBuild();
	const result = await verifyLandingBuild(root);

	assert.equal(result.pageCount, 3);
	assert.equal(result.javascriptFileCount, 1);
});

test('accepts visible heading text wrapped in Svelte markers and nested markup', async () => {
	const root = await createBuild({
		html: '<main id="main-content"><h1><!--[--><!--[0-->Rendered<br>page<!--]--><!--]--></h1></main>'
	});

	await assert.doesNotReject(() => verifyLandingBuild(root));
});

test('does not count JSON-LD structured data as executable inline JavaScript', async () => {
	const root = await createBuild({
		html: '<main id="main-content"><h1>Rendered page</h1></main><script>a()</script><script type="application/ld+json">{}</script><script>b()</script>'
	});

	await assert.doesNotReject(() => verifyLandingBuild(root));
});

test('rejects missing or empty prerendered content', async () => {
	const root = await createBuild({ html: '<main id="main-content"></main>' });

	await assert.rejects(() => verifyLandingBuild(root), /rendered heading/);
});

test('rejects JavaScript file and byte budget regressions', async () => {
	const tooManyFiles = await createBuild({
		scriptNames: Array.from({ length: 18 }, (_, index) => `chunk-${index}.js`)
	});
	await assert.rejects(() => verifyLandingBuild(tooManyFiles), /17 JavaScript files/);

	const tooManyBytes = await createBuild({ scriptContent: 'x'.repeat(180 * 1024 + 1) });
	await assert.rejects(() => verifyLandingBuild(tooManyBytes), /180 KiB/);
});

test('rejects per-page preload, referenced byte, and inline script regressions', async () => {
	const scriptNames = Array.from({ length: 15 }, (_, index) => `chunk-${index}.js`);
	const tooManyPreloads = await createBuild({ scriptNames });
	await assert.rejects(() => verifyLandingBuild(tooManyPreloads), /14 module preloads/);

	const tooManyReferencedBytes = await createBuild({ scriptContent: 'x'.repeat(165 * 1024 + 1) });
	await assert.rejects(() => verifyLandingBuild(tooManyReferencedBytes), /165 KiB/);

	const tooManyInlineScripts = await createBuild({
		html: '<main id="main-content"><h1>Rendered page</h1></main><script>a()</script><script>b()</script><script>c()</script>'
	});
	await assert.rejects(() => verifyLandingBuild(tooManyInlineScripts), /2 inline scripts/);
});
