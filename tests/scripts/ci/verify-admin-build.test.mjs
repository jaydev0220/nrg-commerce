import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('frontend matrix verifies Worker artifact entrypoints and rejects runtime secrets', async () => {
	const workflow = await readFile(
		new URL('../../../.github/workflows/ci-deploy.yml', import.meta.url),
		'utf8'
	);
	assert.match(
		workflow,
		/node scripts\/ci\/verify-frontend-artifact\.mjs "\$\{\{ matrix\.app \}\}"/u
	);
	assert.match(workflow, /PUBLIC_TURNSTILE_SITE_KEY/u);
	assert.match(workflow, /ADMIN_DOMAIN: admin\.nrglabware\.com/u);
});
