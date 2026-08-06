import assert from 'node:assert/strict';
import test from 'node:test';

import {
	defaultRun,
	findExistingRecord,
	importExistingApiDnsRecords
} from '../../../scripts/ci/import-api-dns.mjs';

function response(payload, status = 200) {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

test('findExistingRecord returns a matching CNAME record ID and normalizes its trailing dot', async () => {
	const recordId = await findExistingRecord({
		fetcher: async () =>
			response({
				success: true,
				result: [{ id: 'record-id', content: 'origin.azurecontainerapps.io.' }]
			}),
		zoneId: 'zone-id',
		token: 'token',
		type: 'CNAME',
		name: 'api.example.com',
		expectedContent: 'origin.azurecontainerapps.io'
	});

	assert.equal(recordId, 'record-id');
});

test('defaultRun executes a command with a bounded output buffer', async () => {
	const result = await defaultRun(process.execPath, ['-e', "process.stdout.write('ok')"]);
	assert.equal(result.stdout, 'ok');
});

test('findExistingRecord returns null for a missing record and rejects an unexpected target', async () => {
	const missing = await findExistingRecord({
		fetcher: async () => response({ success: true, result: [] }),
		zoneId: 'zone-id',
		token: 'token',
		type: 'TXT',
		name: 'asuid.api.example.com',
		expectedContent: 'verification'
	});
	assert.equal(missing, null);

	await assert.rejects(
		() =>
			findExistingRecord({
				fetcher: async () =>
					response({ success: true, result: [{ id: 'record-id', content: 'other' }] }),
				zoneId: 'zone-id',
				token: 'token',
				type: 'TXT',
				name: 'asuid.api.example.com',
				expectedContent: 'verification'
			}),
		/ unexpected value/u
	);
});

test('findExistingRecord rejects ambiguous or malformed Cloudflare responses', async () => {
	await assert.rejects(
		() =>
			findExistingRecord({
				fetcher: async () => response({ success: true, result: [{ id: '1' }, { id: '2' }] }),
				zoneId: 'zone-id',
				token: 'token',
				type: 'TXT',
				name: 'asuid.api.example.com',
				expectedContent: 'verification'
			}),
		/Multiple/u
	);
	await assert.rejects(
		() =>
			findExistingRecord({
				fetcher: async () => response({ success: false, result: [] }),
				zoneId: 'zone-id',
				token: 'token',
				type: 'TXT',
				name: 'asuid.api.example.com',
				expectedContent: 'verification'
			}),
		/invalid response/u
	);
	await assert.rejects(
		() =>
			findExistingRecord({
				fetcher: async () => response({}, 502),
				zoneId: 'zone-id',
				token: 'token',
				type: 'TXT',
				name: 'asuid.api.example.com',
				expectedContent: 'verification'
			}),
		/HTTP 502/u
	);
	await assert.rejects(
		() =>
			findExistingRecord({
				fetcher: async () =>
					response({ success: true, result: [{ id: '', content: 'verification' }] }),
				zoneId: 'zone-id',
				token: 'token',
				type: 'TXT',
				name: 'asuid.api.example.com',
				expectedContent: 'verification'
			}),
		/no importable ID/u
	);
});

test('importExistingApiDnsRecords imports unmanaged matching records only once', async () => {
	const calls = [];
	const environment = {
		CLOUDFLARE_ZONE_ID: 'zone-id',
		CLOUDFLARE_API_TOKEN: 'token',
		API_DOMAIN: 'api.example.com',
		TF_VAR_container_app_hostname: 'origin.azurecontainerapps.io',
		TF_VAR_custom_domain_verification_id: 'verification'
	};
	const run = async (command, args) => {
		calls.push([command, args]);
		return { stdout: args.includes('state') ? '' : '' };
	};
	const fetcher = async (input) =>
		response({
			success: true,
			result: [
				{
					id: input.toString().includes('CNAME') ? 'cname-id' : 'txt-id',
					content: input.toString().includes('CNAME')
						? 'origin.azurecontainerapps.io'
						: 'verification'
				}
			]
		});

	await importExistingApiDnsRecords({ environment, run, fetcher });

	const imports = calls.filter(([, args]) => args.includes('import'));
	assert.equal(imports.length, 2);
	assert.deepEqual(
		imports.map(([, args]) => args.at(-1)),
		['zone-id/cname-id', 'zone-id/txt-id']
	);
});

test('importExistingApiDnsRecords treats a missing Terraform state as empty on first deploy', async () => {
	const calls = [];
	const environment = {
		CLOUDFLARE_ZONE_ID: 'zone-id',
		CLOUDFLARE_API_TOKEN: 'token',
		API_DOMAIN: 'api.example.com',
		TF_VAR_container_app_hostname: 'origin.azurecontainerapps.io',
		TF_VAR_custom_domain_verification_id: 'verification'
	};
	const run = async (command, args) => {
		calls.push([command, args]);
		if (args.includes('state')) {
			const error = new Error('terraform state list failed');
			error.stderr = 'No state file was found!';
			throw error;
		}
		return { stdout: '' };
	};
	const fetcher = async (input) =>
		response({
			success: true,
			result: [
				{
					id: input.toString().includes('CNAME') ? 'cname-id' : 'txt-id',
					content: input.toString().includes('CNAME')
						? 'origin.azurecontainerapps.io'
						: 'verification'
				}
			]
		});

	await importExistingApiDnsRecords({ environment, run, fetcher });

	assert.equal(calls.filter(([, args]) => args.includes('import')).length, 2);
});

test('importExistingApiDnsRecords propagates unexpected Terraform state failures', async () => {
	const environment = {
		CLOUDFLARE_ZONE_ID: 'zone-id',
		CLOUDFLARE_API_TOKEN: 'token',
		API_DOMAIN: 'api.example.com',
		TF_VAR_container_app_hostname: 'origin.azurecontainerapps.io',
		TF_VAR_custom_domain_verification_id: 'verification'
	};
	const expected = new Error('terraform state list failed');
	expected.stderr = 'Failed to load remote state';

	await assert.rejects(
		() =>
			importExistingApiDnsRecords({
				environment,
				run: async () => {
					throw expected;
				},
				fetcher: async () => response({ success: true, result: [] })
			}),
		(error) => error === expected
	);
});

test('importExistingApiDnsRecords skips state-managed and missing records', async () => {
	const calls = [];
	const environment = {
		CLOUDFLARE_ZONE_ID: 'zone-id',
		CLOUDFLARE_API_TOKEN: 'token',
		API_DOMAIN: 'api.example.com',
		TF_VAR_container_app_hostname: 'origin.azurecontainerapps.io',
		TF_VAR_custom_domain_verification_id: 'verification'
	};
	const run = async (command, args) => {
		calls.push([command, args]);
		return { stdout: args.includes('state') ? 'cloudflare_dns_record.api_cname\n' : '' };
	};
	await importExistingApiDnsRecords({
		environment,
		run,
		fetcher: async () => response({ success: true, result: [] })
	});
	assert.equal(calls.filter(([, args]) => args.includes('import')).length, 0);
});
