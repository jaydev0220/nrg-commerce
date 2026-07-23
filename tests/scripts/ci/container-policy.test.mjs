import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const repositoryRoot = new URL('../../../', import.meta.url);

test('the API build context excludes local credentials and generated output', async () => {
	const dockerignore = await readFile(new URL('.dockerignore', repositoryRoot), 'utf8');
	const ignoredEntries = new Set(dockerignore.split(/\r?\n/u));

	for (const entry of [
		'**/.env',
		'**/.dev.vars',
		'**/*.pem',
		'**/*.key',
		'**/node_modules',
		'**/generated'
	]) {
		assert.ok(ignoredEntries.has(entry), `Expected ${entry} in .dockerignore.`);
	}
});

test('the API runtime image is digest-pinned, minimal, and non-root', async () => {
	const dockerfile = await readFile(new URL('apps/api/Dockerfile', repositoryRoot), 'utf8');

	assert.match(dockerfile, /^FROM node:[^\s]+@sha256:[0-9a-f]{64} AS base$/mu);
	assert.match(dockerfile, /^FROM scratch AS runtime$/mu);
	assert.match(dockerfile, /^USER 65532:65532$/mu);
	assert.match(dockerfile, /^HEALTHCHECK /mu);
});
