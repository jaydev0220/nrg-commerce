import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('landing build is included in the production frontend matrix', async () => {
	const workflow = await readFile(
		new URL('../../../.github/workflows/ci-deploy.yml', import.meta.url),
		'utf8'
	);
	assert.match(workflow, /app: landing[\s\S]*?domain: www\.nrglabware\.com/u);
	assert.match(
		workflow,
		/node scripts\/ci\/verify-frontend-artifact\.mjs "\$\{\{ matrix\.app \}\}"/u
	);
	assert.match(workflow, /PUBLIC_SITE_URL: https:\/\/www\.nrglabware\.com/u);
});
