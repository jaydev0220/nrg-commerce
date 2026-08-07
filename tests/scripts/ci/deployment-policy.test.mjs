import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);

function jobBlock(workflow, name) {
	const start = workflow.indexOf(`  ${name}:`);
	assert.notEqual(start, -1, `Missing ${name}`);
	const next = workflow.slice(start + 4).search(/^  [a-z0-9-]+:\s*$/mu);
	return workflow.slice(start, next === -1 ? undefined : start + 4 + next);
}

test('all production mutations are behind the aggregate validation gate', async () => {
	const workflow = await readFile(new URL('.github/workflows/ci-deploy.yml', root), 'utf8');
	assert.match(workflow, /needs: \[quality, tests, build, terraform, security\]/u);
	assert.match(workflow, /needs: \[gate, fresh-main\]/u);
	for (const job of [
		'plan',
		'apply-infrastructure',
		'sync-secrets',
		'migrate',
		'deploy-api',
		'deploy-contact',
		'deploy-frontends'
	]) {
		const block = jobBlock(workflow, job);
		assert.match(block, /if: github\.event_name != 'pull_request'/u);
		assert.match(block, /needs:/u);
	}
});

test('the release uses protected plan/apply environments and exact encrypted plan hashes', async () => {
	const workflow = await readFile(new URL('.github/workflows/ci-deploy.yml', root), 'utf8');
	assert.match(workflow, /environment: production-plan/u);
	assert.match(workflow, /environment: production/u);
	assert.match(workflow, /age --encrypt --recipient/u);
	assert.match(workflow, /sha256sum deployment\.tfplan\.age/u);
	assert.match(workflow, /terraform -chdir=infra\/production apply .*deployment\.tfplan/u);
	assert.doesNotMatch(workflow, /-auto-approve/u);
});

test('release ordering migrates before API, contact, and frontend deployments', async () => {
	const workflow = await readFile(new URL('.github/workflows/ci-deploy.yml', root), 'utf8');
	assert.match(workflow, /deploy-api:[\s\S]*?needs: \[migrate, publish-api-image\]/u);
	assert.match(workflow, /deploy-contact:[\s\S]*?needs: \[migrate\]/u);
	assert.match(
		workflow,
		/deploy-frontends:[\s\S]*?needs: \[apply-infrastructure, deploy-api, deploy-contact\]/u
	);
	assert.match(workflow, /strategy:[\s\S]*?matrix:/u);
	assert.match(workflow, /revision show[\s\S]*?properties\.healthState/u);
	assert.match(workflow, /--revision "\$revision_name" --weight 0/u);
	assert.match(workflow, /--revision "\$revision_name" --weight 100/u);
});

test('release manifest captures provider control-plane version identifiers', async () => {
	const workflow = await readFile(new URL('.github/workflows/ci-deploy.yml', root), 'utf8');
	assert.match(workflow, /wrangler versions list[\s\S]*?--json/u);
	assert.match(workflow, /worker_versions=/u);
	assert.match(workflow, /retention-days: 90/u);
});

test('contact deployment reads the generated Turnstile secret without a GitHub secret copy', async () => {
	const workflow = await readFile(new URL('.github/workflows/ci-deploy.yml', root), 'utf8');
	assert.match(workflow, /output -raw turnstile_secret_key/u);
	assert.doesNotMatch(workflow, /TURNSTILE_SECRET_KEY: \$\{\{ secrets\./u);
});

test('production workflows never probe public application URLs', async () => {
	const files = await Promise.all(
		[
			'ci-deploy.yml',
			'bootstrap-production.yml',
			'bootstrap-admin.yml',
			'backup-database.yml',
			'restore-drill.yml',
			'rollback-production.yml',
			'certificate-expiry.yml',
			'terraform-drift.yml'
		].map((name) => readFile(new URL(`.github/workflows/${name}`, root), 'utf8'))
	);
	for (const workflow of files) {
		assert.doesNotMatch(
			workflow,
			/\b(?:curl|wget)\b[^\n]*(?:nrglabware\.com|workers\.dev|azurecontainerapps\.io)|fetch\s*\(/iu
		);
	}
	assert.match(files[4], /console\.neon\.tech\/api\/v2/u);
});

test('restore drill creates and deletes an isolated Neon branch', async () => {
	const workflow = await readFile(new URL('.github/workflows/restore-drill.yml', root), 'utf8');
	assert.match(workflow, /POST .*branches/u);
	assert.match(workflow, /hard_delete=true/u);
	assert.match(workflow, /prisma migrate status/u);
	assert.doesNotMatch(workflow, /RESTORE_DRILL_DATABASE_URL/u);
});

test('release concurrency is non-canceling after mutation can begin', async () => {
	const workflow = await readFile(new URL('.github/workflows/ci-deploy.yml', root), 'utf8');
	assert.match(workflow, /group:.*nrg-commerce-production/u);
	assert.match(workflow, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/u);
	assert.match(workflow, /Require the current main commit/u);
});
