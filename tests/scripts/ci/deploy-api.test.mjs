import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);

test('API release uses immutable images and control-plane-only revision promotion', async () => {
	const workflow = await readFile(new URL('.github/workflows/ci-deploy.yml', root), 'utf8');
	assert.match(workflow, /IMAGE_NAME: ghcr\.io\/jaydev0220\/nrg-commerce-api/u);
	assert.match(
		workflow,
		/API_IMAGE: \$\{\{ env\.IMAGE_NAME \}\}@\$\{\{ needs\.publish-api-image\.outputs\.image-digest \}\}/u
	);
	assert.match(workflow, /revision_suffix="api-\$\{GITHUB_SHA::12\}"/u);
	assert.match(workflow, /revision_name="\$\{AZURE_CONTAINER_APP_NAME\}--\$\{revision_suffix\}"/u);
	assert.match(workflow, /--revision "\$revision_name" --weight 0/u);
	assert.match(workflow, /properties\.runningState/u);
	assert.match(workflow, /properties\.healthState/u);
	assert.match(workflow, /--revision "\$revision_name" --weight 100/u);
	assert.doesNotMatch(workflow, /api\.nrglabware\.com[^\n]*(curl|wget|fetch)/iu);
});

test('Terraform requires digest-pinned API images', async () => {
	const variables = await readFile(new URL('infra/production/variables.tf', root), 'utf8');
	assert.match(variables, /ghcr/u);
	assert.match(variables, /@sha256:\[a-f0-9\]\{64\}/u);
});
