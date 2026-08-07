import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);

test('Terraform owns API DNS and Azure custom-domain verification records', async () => {
	const main = await readFile(new URL('infra/production/main.tf', root), 'utf8');
	assert.match(main, /resource "cloudflare_dns_record" "api"/u);
	assert.match(main, /resource "cloudflare_dns_record" "api_verification"/u);
	assert.match(main, /resource "azurerm_container_app_custom_domain" "api"/u);
	assert.doesNotMatch(main, /API_DNS_TF_WORKSPACE|import-api-dns/u);
});

test('API DNS stays DNS-only until the final bootstrap phase', async () => {
	const workflow = await readFile(
		new URL('.github/workflows/bootstrap-production.yml', root),
		'utf8'
	);
	assert.match(
		workflow,
		/TF_VAR_enable_cloudflare_proxy: \$\{\{ inputs\.phase == 'phase-3-proxy' && 'true' \|\| 'false' \}\}/u
	);
	assert.match(
		workflow,
		/TF_VAR_origin_certificate_enabled: \$\{\{ inputs\.phase == 'phase-1-base' && 'false' \|\| 'true' \}\}/u
	);
});
