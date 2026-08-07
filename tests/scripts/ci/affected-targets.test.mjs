import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);

test('production release deploys every requested application without affected-target shortcuts', async () => {
	const workflow = await readFile(new URL('.github/workflows/ci-deploy.yml', root), 'utf8');
	assert.doesNotMatch(workflow, /affected-targets|MANUAL_TARGET|staging/u);
	for (const job of ['publish-api-image', 'deploy-api', 'deploy-contact', 'deploy-frontends']) {
		assert.match(workflow, new RegExp(`^  ${job}:`, 'mu'));
	}
	for (const app of ['admin', 'catalog', 'landing']) {
		assert.match(workflow, new RegExp(`app: ${app}`, 'u'));
	}
	assert.match(workflow, /apps\/contact-worker/u);
});

test('Worker configurations expose production names only', async () => {
	const configs = await Promise.all(
		['admin', 'catalog', 'landing', 'contact-worker'].map((app) =>
			readFile(new URL(`apps/${app}/wrangler.jsonc`, root), 'utf8')
		)
	);
	for (const config of configs) {
		assert.match(config, /"production"/u);
		assert.doesNotMatch(config, /"staging"/u);
	}
});
