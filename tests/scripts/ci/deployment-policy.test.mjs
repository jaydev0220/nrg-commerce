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

test('production releases wait for the bootstrap completion marker', async () => {
	const workflow = await readFile(new URL('.github/workflows/ci-deploy.yml', root), 'utf8');
	const status = jobBlock(workflow, 'bootstrap-status');
	assert.match(status, /needs: \[gate, fresh-main\]/u);
	assert.match(status, /environment: production-plan/u);
	assert.match(status, /az keyvault secret show[\s\S]*?--name bootstrap-complete/u);
	assert.match(status, /complete: \$\{\{ steps\.check\.outputs\.complete \}\}/u);

	for (const job of ['publish-api-image', 'plan']) {
		const block = jobBlock(workflow, job);
		assert.match(block, /needs\.bootstrap-status\.outputs\.complete == 'true'/u);
		assert.match(block, /needs: \[[^\]]*bootstrap-status[^\]]*\]/u);
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

test('quality and database tests provide the complete CI environment contract', async () => {
	const workflow = await readFile(new URL('.github/workflows/ci-deploy.yml', root), 'utf8');
	const quality = jobBlock(workflow, 'quality');
	for (const name of [
		'CI',
		'PUBLIC_API_BASE_URL',
		'PUBLIC_CDN_BASE_URL',
		'PUBLIC_COOKIE_DOMAIN',
		'PUBLIC_CONTACT_WORKER_URL',
		'PUBLIC_CTA_URL',
		'PUBLIC_FACEBOOK_URL',
		'PUBLIC_HOME_URL',
		'PUBLIC_LINE_URL',
		'PUBLIC_SITE_URL',
		'PUBLIC_TURNSTILE_SITE_KEY',
		'CONTACT_SENDER_EMAIL',
		'CONTACT_RECIPIENT_EMAIL',
		'TURNSTILE_SECRET_KEY'
	]) {
		assert.match(quality, new RegExp(`^      ${name}:`, 'mu'), `Missing quality env ${name}`);
	}

	const tests = jobBlock(workflow, 'tests');
	assert.match(tests, /^      DATABASE_URL:/mu);
	assert.match(tests, /^      TEST_DATABASE_URL:/mu);
	assert.match(tests, /postgres:18@sha256:[0-9a-f]{64}/u);

	const helpers = await Promise.all([
		readFile(new URL('apps/api/tests/test-database.ts', root), 'utf8'),
		readFile(new URL('packages/database/tests/test-database.ts', root), 'utf8')
	]);
	for (const helper of helpers) {
		assert.match(helper, /process\.env\['CI'\] === 'true'/u);
		assert.match(helper, /TEST_DATABASE_URL must be configured/u);
	}
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

test('release jobs have bounded timeouts and Terraform setup where required', async () => {
	const workflow = await readFile(new URL('.github/workflows/ci-deploy.yml', root), 'utf8');
	for (const [job, timeout] of [
		['gate', 5],
		['fresh-main', 5],
		['bootstrap-status', 10],
		['publish-api-image', 30],
		['terraform', 30],
		['plan', 30],
		['apply-infrastructure', 30],
		['sync-secrets', 15],
		['migrate', 30],
		['deploy-api', 15],
		['deploy-contact', 15],
		['deploy-frontends', 15],
		['release-manifest', 15]
	]) {
		assert.match(jobBlock(workflow, job), new RegExp(`timeout-minutes: ${timeout}`, 'u'));
	}
	assert.match(jobBlock(workflow, 'migrate'), /hashicorp\/setup-terraform@[0-9a-f]{40}/u);
});

test('bootstrap decrypts the saved plan with its step-scoped age identity', async () => {
	const workflow = await readFile(
		new URL('.github/workflows/bootstrap-production.yml', root),
		'utf8'
	);
	assert.match(
		jobBlock(workflow, 'apply'),
		/- name: Decrypt bootstrap plan\s+env:\s+TF_PLAN_AGE_IDENTITY: \$\{\{ secrets\.TF_PLAN_AGE_IDENTITY \}\}\s+run: \|\s+test -n "\$TF_PLAN_AGE_IDENTITY"\s+printf '%s' "\$TF_PLAN_AGE_IDENTITY"[\s\S]*?age --decrypt --identity identity\.txt/u
	);
});

test('production Terraform imports the existing redirect entry point with provider-compatible values', async () => {
	const [main, variables, ...workflows] = await Promise.all([
		readFile(new URL('infra/production/main.tf', root), 'utf8'),
		readFile(new URL('infra/production/variables.tf', root), 'utf8'),
		...['bootstrap-production.yml', 'ci-deploy.yml', 'terraform-drift.yml'].map((name) =>
			readFile(new URL(`.github/workflows/${name}`, root), 'utf8')
		)
	]);
	assert.match(main, /resource "cloudflare_ruleset" "apex_to_www"/u);
	assert.match(main, /import\s*\{\s*to = cloudflare_ruleset\.apex_to_www/u);
	assert.match(
		main,
		/id = "zones\/\$\{var\.cloudflare_zone_id\}\/9400b85150d84175ab1b1b16e4544e3d"/u
	);
	assert.match(main, /ref\s+= "apex-to-www"/u);
	assert.match(main, /formatdate\("YYYY-MM-01'T'00:00:00Z", plantimestamp\(\)\)/u);
	assert.match(main, /ignore_changes = \[time_period\[0\]\.start_date\]/u);
	assert.match(variables, /variable "cloudflare_zone_id"/u);
	for (const workflow of workflows) {
		assert.match(workflow, /TF_VAR_cloudflare_zone_id/u);
	}
	const [bootstrap] = workflows;
	assert.match(bootstrap, /- name: Initialize Terraform for apply/u);
	assert.match(bootstrap, /- name: Apply bootstrap plan and mark phase/u);
});

test('production Neon resources stay within Free plan limits and wait for the endpoint', async () => {
	const main = await readFile(new URL('infra/production/main.tf', root), 'utf8');
	assert.match(main, /pg_version\s+= 18/u);
	assert.match(main, /history_retention_seconds\s+= 21600/u);
	assert.doesNotMatch(main, /default_branch_protected/u);
	assert.match(main, /resource "neon_branch" "production" \{[\s\S]*?protected\s+= "no"[\s\S]*?\}/u);
	assert.equal((main.match(/autoscaling_limit_max_cu\s+= 1/gu) ?? []).length, 2);
	assert.doesNotMatch(main, /suspend_timeout_seconds/u);
	for (const role of ['owner', 'app', 'backup']) {
		assert.match(
			main,
			new RegExp(
				`resource "neon_role" "${role}" \\{[\\s\\S]*?depends_on = \\[neon_endpoint\\.production\\][\\s\\S]*?\\}`,
				'u'
			)
		);
	}
});

test('phase-two Azure resources include the certificate identity, location, and IPv4 ingress ranges', async () => {
	const main = await readFile(new URL('infra/production/main.tf', root), 'utf8');
	assert.match(
		main,
		/import \{\s+for_each = var\.bootstrap_phase == "phase-1-base" \? \{\} : \{ api = 0 \}\s+to\s+= azurerm_container_app\.api\[each\.value\][\s\S]*?id\s+= "\/subscriptions\/\$\{var\.azure_subscription_id\}[\s\S]*?\/containerApps\/ca-\$\{local\.resource_prefix\}-api"\s+\}/u
	);
	assert.match(
		main,
		/resource "azurerm_container_app_environment" "production" \{[\s\S]*?identity \{\s+type\s+= "UserAssigned"\s+identity_ids\s+= \[azurerm_user_assigned_identity\.certificate_reader\.id\][\s\S]*?\}/u
	);
	assert.match(
		main,
		/resource "azapi_resource" "origin_certificate" \{[\s\S]*?location\s+= azurerm_container_app_environment\.production\.location[\s\S]*?body = \{/u
	);
	assert.match(
		main,
		/dynamic "ip_security_restriction" \{\s+for_each = toset\(data\.cloudflare_ip_ranges\.current\.ipv4_cidrs\)/u
	);
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
	assert.match(workflow, /production-env\.mjs contact/u);
	assert.match(workflow, /production-env\.mjs "\$\{\{ matrix\.app \}\}"/u);
	assert.doesNotMatch(workflow, /TURNSTILE_SECRET_KEY: \$\{\{ secrets\./u);
});

test('production operations pin PostgreSQL 18 client tooling and rollback health', async () => {
	const [backup, restore, rollback] = await Promise.all(
		['backup-database.yml', 'restore-drill.yml', 'rollback-production.yml'].map((name) =>
			readFile(new URL(`.github/workflows/${name}`, root), 'utf8')
		)
	);
	for (const workflow of [backup, restore]) {
		assert.match(workflow, /postgres:18@sha256:[0-9a-f]{64}/u);
		assert.match(workflow, /docker run .*POSTGRES_IMAGE/u);
	}
	assert.match(rollback, /properties\.healthState/u);
	assert.match(rollback, /Healthy/u);
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
