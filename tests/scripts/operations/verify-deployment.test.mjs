import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('live URL smoke verification is intentionally absent from production workflows', async () => {
	const root = new URL('../../../', import.meta.url);
	const workflow = await readFile(new URL('.github/workflows/ci-deploy.yml', root), 'utf8');
	assert.doesNotMatch(
		workflow,
		/verify-deployment|VERIFY_API_BASE_URL|VERIFY_CONTACT_URL|curl|wget|fetch\s*\(/u
	);
	await assert.rejects(
		() => readFile(new URL('../../../scripts/operations/verify-deployment.mjs', import.meta.url)),
		(error) => error?.code === 'ENOENT'
	);
});
