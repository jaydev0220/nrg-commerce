import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowPath = new URL('../../../.github/workflows/ci-deploy.yml', import.meta.url);
const contactWorkerConfigPath = new URL(
	'../../../apps/contact-worker/wrangler.jsonc',
	import.meta.url
);
const landingWorkerConfigPath = new URL('../../../apps/landing/wrangler.jsonc', import.meta.url);

function readJob(source, jobName) {
	const marker = `  ${jobName}:\n`;
	const start = source.indexOf(marker);
	assert.notEqual(start, -1, `Expected workflow job ${jobName}.`);
	const nextJobPattern = /^ {2}[a-z0-9-]+:\s*$/gmu;
	nextJobPattern.lastIndex = start + marker.length;
	const nextJob = nextJobPattern.exec(source);
	return source.slice(start, nextJob?.index);
}

test('every deployment publication job is restricted to the main branch', async () => {
	const workflow = await readFile(workflowPath, 'utf8');

	for (const jobName of [
		'deploy-workers-staging',
		'deploy-workers-production',
		'publish-api-image',
		'deploy-landing-staging',
		'deploy-landing-production'
	]) {
		assert.match(readJob(workflow, jobName), /github\.ref == 'refs\/heads\/main'/u);
	}
});

test('CI rejects moderate dependency advisories and reconciles Worker variables', async () => {
	const workflow = await readFile(workflowPath, 'utf8');

	assert.match(workflow, /pnpm audit --audit-level moderate/u);
	assert.doesNotMatch(workflow, /--keep-vars/u);
});

test('staging contact limits permit the required capacity test without weakening production', async () => {
	const config = JSON.parse(await readFile(contactWorkerConfigPath, 'utf8'));
	const staging = config.env.staging.ratelimits[0];
	const production = config.env.production.ratelimits[0];

	assert.equal(staging.simple.period, 60);
	assert.ok(staging.simple.limit >= 400);
	assert.deepEqual(production.simple, { limit: 10, period: 60 });
	assert.notEqual(staging.namespace_id, production.namespace_id);
});

test('CI scans complete repository history for secrets with an immutable scanner', async () => {
	const workflow = await readFile(workflowPath, 'utf8');
	const validation = readJob(workflow, 'validate');

	assert.match(validation, /fetch-depth: 0/u);
	assert.match(validation, /zricethezav\/gitleaks@sha256:[a-f0-9]{64}/u);
	assert.match(validation, /detect --source=\/repo --no-banner --redact --exit-code=1/u);
	assert.match(validation, /--gitleaks-ignore-path=\/repo\/\.gitleaksignore/u);
});

test('CI applies migrations and rejects migration drift using an isolated shadow database', async () => {
	const workflow = await readFile(workflowPath, 'utf8');
	const validation = readJob(workflow, 'validate');

	assert.match(validation, /SHADOW_DATABASE_ADMIN_URL: .*\/postgres/u);
	assert.match(validation, /SHADOW_DATABASE_URL: .*\/nrg_commerce_shadow/u);
	assert.match(validation, /run: pnpm db:shadow:create/u);
	assert.match(validation, /run: pnpm db:deploy/u);
	assert.match(validation, /run: pnpm db:diff/u);
});

test('deployment credentials are scoped to steps and Terraform applies a saved plan', async () => {
	const workflow = await readFile(workflowPath, 'utf8');

	for (const jobName of [
		'deploy-workers-staging',
		'deploy-workers-production',
		'deploy-landing-staging',
		'deploy-landing-production'
	]) {
		const job = readJob(workflow, jobName);
		const jobConfiguration = job.slice(0, job.indexOf('\n    steps:'));
		assert.doesNotMatch(jobConfiguration, /\$\{\{\s*secrets\./u);
	}

	for (const jobName of ['deploy-workers-staging', 'deploy-workers-production']) {
		const job = readJob(workflow, jobName);
		assert.match(job, /plan .* -out=deployment\.tfplan/u);
		assert.match(job, /apply .* deployment\.tfplan/u);
	}

	const checkoutCount = workflow.match(/uses: actions\/checkout@/gu)?.length ?? 0;
	const protectedCheckoutCount = workflow.match(/persist-credentials: false/gu)?.length ?? 0;
	assert.equal(protectedCheckoutCount, checkoutCount);
});

test('landing uses assets-only Cloudflare deployments with staging promotion', async () => {
	const workflow = await readFile(workflowPath, 'utf8');
	const config = JSON.parse(await readFile(landingWorkerConfigPath, 'utf8'));
	const workers = readJob(workflow, 'deploy-workers-production');
	const staging = readJob(workflow, 'deploy-landing-staging');
	const production = readJob(workflow, 'deploy-landing-production');

	assert.match(workers, /needs: \[changes, deploy-workers-staging, publish-api-image\]/u);
	assert.match(workers, /needs\.publish-api-image\.result == 'success'/u);
	assert.match(workers, /needs\.publish-api-image\.result == 'skipped'/u);
	assert.match(staging, /environment:\n      name: staging/u);
	assert.match(staging, /wrangler deploy --env staging --domain "\$LANDING_DOMAIN"/u);
	assert.match(production, /environment:\n      name: production/u);
	assert.match(
		production,
		/needs: \[changes, build-api-image, deploy-landing-staging, deploy-workers-production\]/u
	);
	assert.match(production, /needs\.deploy-landing-staging\.result == 'success'/u);
	assert.match(production, /needs\.deploy-workers-production\.result == 'success'/u);
	assert.match(production, /needs\.deploy-workers-production\.result == 'skipped'/u);
	assert.match(production, /wrangler deploy --env production --domain "\$LANDING_DOMAIN"/u);

	assert.equal(config.main, undefined);
	assert.equal(config.assets.binding, undefined);
	assert.deepEqual(config.assets, {
		directory: '.svelte-kit/cloudflare',
		html_handling: 'auto-trailing-slash',
		not_found_handling: '404-page'
	});
	assert.notEqual(config.env.staging.name, config.env.production.name);
});

test('the API publication scans the immutable SHA image and never publishes latest', async () => {
	const workflow = await readFile(workflowPath, 'utf8');
	const publication = readJob(workflow, 'publish-api-image');
	const publishIndex = publication.indexOf('Build and publish API image');
	const scanIndex = publication.indexOf('Scan published API image');

	assert.ok(publishIndex >= 0);
	assert.ok(scanIndex > publishIndex);
	assert.match(publication, /nrg-commerce-api:\$\{\{ github\.sha \}\}/u);
	assert.doesNotMatch(publication, /value=latest/u);
});
