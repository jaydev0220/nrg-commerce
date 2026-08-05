import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const execFile = promisify(execFileCallback);
const terraformDirectory = 'infra/api-dns';

export async function defaultRun(command, args, options = {}) {
	return execFile(command, args, { ...options, maxBuffer: 4 * 1024 * 1024 });
}

function required(environment, name) {
	const value = environment[name]?.trim();
	if (!value) throw new Error(`${name} is required.`);
	return value;
}

function normalizeCname(value) {
	return value.trim().replace(/\.$/u, '').toLowerCase();
}

export async function findExistingRecord({ fetcher, zoneId, token, type, name, expectedContent }) {
	const endpoint = new URL(
		`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/dns_records`
	);
	endpoint.searchParams.set('type', type);
	endpoint.searchParams.set('name', name);
	const response = await fetcher(endpoint, {
		headers: { authorization: `Bearer ${token}`, accept: 'application/json' }
	});
	if (!response.ok) throw new Error(`Cloudflare DNS lookup failed with HTTP ${response.status}.`);

	const payload = await response.json();
	if (!payload?.success || !Array.isArray(payload.result)) {
		throw new Error('Cloudflare DNS lookup returned an invalid response.');
	}
	if (payload.result.length > 1) {
		throw new Error(`Multiple ${type} records exist for ${name}; refusing to import ambiguously.`);
	}
	const record = payload.result[0];
	if (!record) return null;

	const actualContent = type === 'CNAME' ? normalizeCname(record.content) : record.content?.trim();
	const expected = type === 'CNAME' ? normalizeCname(expectedContent) : expectedContent.trim();
	if (actualContent !== expected) {
		throw new Error(`Existing ${type} record for ${name} points to an unexpected value.`);
	}
	if (typeof record.id !== 'string' || record.id.length === 0) {
		throw new Error(`Existing ${type} record for ${name} has no importable ID.`);
	}

	return record.id;
}

export async function importExistingApiDnsRecords({
	environment = process.env,
	fetcher = fetch,
	run = defaultRun
} = {}) {
	const zoneId = required(environment, 'CLOUDFLARE_ZONE_ID');
	const token = required(environment, 'CLOUDFLARE_API_TOKEN');
	const apiDomain = required(environment, 'API_DOMAIN');
	const containerAppHostname = required(environment, 'TF_VAR_container_app_hostname');
	const verificationId = required(environment, 'TF_VAR_custom_domain_verification_id');
	const state = await run('terraform', ['-chdir=' + terraformDirectory, 'state', 'list']);
	const stateResources = new Set((state.stdout ?? '').split(/\r?\n/u).filter(Boolean));
	const records = [
		{
			address: 'cloudflare_dns_record.api_cname',
			type: 'CNAME',
			name: apiDomain,
			expectedContent: containerAppHostname
		},
		{
			address: 'cloudflare_dns_record.api_verification',
			type: 'TXT',
			name: `asuid.${apiDomain}`,
			expectedContent: verificationId
		}
	];

	for (const record of records) {
		if (stateResources.has(record.address)) continue;
		const recordId = await findExistingRecord({
			fetcher,
			zoneId,
			token,
			type: record.type,
			name: record.name,
			expectedContent: record.expectedContent
		});
		if (!recordId) continue;

		await run('terraform', [
			`-chdir=${terraformDirectory}`,
			'import',
			'-input=false',
			record.address,
			`${zoneId}/${recordId}`
		]);
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	await importExistingApiDnsRecords();
	process.stdout.write('Reconciled existing API DNS records.\n');
}
