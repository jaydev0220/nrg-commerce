import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const require = createRequire(new URL('../../../apps/admin/package.json', import.meta.url));
const optionsUrl = new URL(
	'./utils/options.js',
	pathToFileURL(require.resolve('@sveltejs/vite-plugin-svelte'))
);
const { preResolveOptions } = await import(optionsUrl.href);

test('patched Svelte option merging preserves precedence, functions, and array replacement', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'nrg-svelte-options-'));
	try {
		const configFile = join(directory, 'svelte.config.mjs');
		await writeFile(
			configFile,
			`export default {
			extensions: ['.svelte', '.md'],
			compilerOptions: { dev: false, css: 'external' },
			preprocess: [{ name: 'config' }]
		};`
		);
		const script = () => undefined;
		const preprocess = [{ name: 'inline', script }];
		const result = await preResolveOptions(
			{ configFile, extensions: ['.svx'], compilerOptions: { dev: true }, preprocess },
			{ root: directory },
			{ command: 'build', mode: 'production' }
		);
		assert.deepEqual(result.extensions, ['.svx']);
		assert.deepEqual(result.compilerOptions, { dev: true, css: 'external' });
		assert.deepEqual(result.preprocess, preprocess);
		assert.equal(result.preprocess[0].script, script);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test('patched Svelte option merging cannot poison the returned object prototype', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'nrg-svelte-options-'));
	try {
		const configFile = join(directory, 'svelte.config.mjs');
		await writeFile(configFile, 'export default { compilerOptions: { customElement: null } };');
		const compilerOptions = JSON.parse('{"customElement":{"__proto__":{"polluted":true}}}');
		const result = await preResolveOptions(
			{ configFile, compilerOptions },
			{ root: directory },
			{ command: 'build', mode: 'production' }
		);
		assert.equal(Object.getPrototypeOf(result.compilerOptions.customElement), Object.prototype);
		assert.equal(result.compilerOptions.customElement.polluted, undefined);
		assert.equal({}.polluted, undefined);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
