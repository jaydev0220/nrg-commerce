import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('frontend matrix verifies Worker artifact entrypoints and rejects runtime secrets', async () => {
	const workflow = await readFile(
		new URL('../../../.github/workflows/ci-deploy.yml', import.meta.url),
		'utf8'
	);
	assert.match(workflow, /Verify artifact contents[\s\S]*?_worker\.js/u);
	assert.match(workflow, /PUBLIC_TURNSTILE_SITE_KEY/u);
	assert.match(
		workflow,
		/ACCESS_TOKEN_SECRET\|REFRESH_TOKEN_SECRET\|TURNSTILE_SECRET_KEY\|DATABASE_URL/u
	);
});
