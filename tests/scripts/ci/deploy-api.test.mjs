import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildCreateArguments,
	buildTemplatePatch,
	defaultRun,
	deployApi,
	ensureAzureInfrastructure,
	fetchCloudflareIpv4Cidrs,
	parseApiDeploymentEnvironment,
	reconcileIngressRules,
	ruleNameForCidr
} from '../../../scripts/ci/deploy-api.mjs';

const image = 'ghcr.io/jaydev0220/nrg-commerce-api@sha256:' + 'a'.repeat(64);
const deploymentEnvironment = {
	AZURE_RESOURCE_GROUP: 'nrg-commerce',
	AZURE_LOCATION: 'eastasia',
	AZURE_CONTAINER_APP_ENVIRONMENT: 'nrg-commerce',
	AZURE_CONTAINER_APP_NAME: 'nrg-commerce-api',
	API_DOMAIN: 'api.example.com',
	CLOUDFLARE_ZONE_ID: '0123456789abcdef0123456789abcdef',
	API_DNS_TF_WORKSPACE: 'nrg-commerce-api-dns-production',
	TF_CLOUD_ORGANIZATION: 'example',
	TF_CLOUD_PROJECT: 'commerce',
	DATABASE_URL: 'postgresql://app:secret@db.example.com/app?sslmode=verify-full',
	ACCESS_TOKEN_SECRET: 'access',
	REFRESH_TOKEN_SECRET: 'refresh',
	PENDING_TOKEN_SECRET: 'pending',
	DATA_ENCRYPTION_SECRET: 'encryption',
	R2_ACCESS_KEY_ID: 'r2-access',
	R2_SECRET_ACCESS_KEY: 'r2-secret',
	OTEL_RESOURCE_ATTRIBUTES: 'service.namespace=nrg-commerce,deployment.environment.name=production'
};

function json(value) {
	return { stdout: JSON.stringify(value) };
}

test('parseApiDeploymentEnvironment requires an immutable digest and creates a configuration-bound revision suffix', () => {
	const config = parseApiDeploymentEnvironment(deploymentEnvironment, image, 'production');
	assert.match(config.revisionSuffix, /^api-[a-f0-9]{12}$/u);
	assert.equal(config.apiDomain, 'api.example.com');
	assert.notEqual(
		parseApiDeploymentEnvironment(
			{ ...deploymentEnvironment, ACCESS_TOKEN_SECRET: 'rotated-access' },
			image,
			'production'
		).revisionSuffix,
		config.revisionSuffix
	);
	assert.equal(config.location, 'eastasia');
	assert.throws(
		() =>
			parseApiDeploymentEnvironment(
				deploymentEnvironment,
				'ghcr.io/example/api:latest',
				'production'
			),
		/immutable GHCR/u
	);
	assert.throws(
		() => parseApiDeploymentEnvironment(deploymentEnvironment, image, 'preview'),
		/staging or production/u
	);
	assert.throws(
		() =>
			parseApiDeploymentEnvironment(
				{ ...deploymentEnvironment, API_DOMAIN: '   ' },
				image,
				'production'
			),
		/API_DOMAIN is required/u
	);
});

test('defaultRun executes a command with a bounded output buffer', async () => {
	const result = await defaultRun(process.execPath, ['-e', "process.stdout.write('ok')"]);
	assert.equal(result.stdout, 'ok');
});

test('buildCreateArguments configures the public port, resource bounds, secret references, and multiple revisions', () => {
	const config = parseApiDeploymentEnvironment(deploymentEnvironment, image, 'production');
	const args = buildCreateArguments(config, deploymentEnvironment);

	assert.ok(args.includes('--revisions-mode'));
	assert.ok(args.includes('multiple'));
	assert.ok(args.includes('--target-port'));
	assert.ok(args.includes('8080'));
	assert.ok(!args.includes('--registry-server'));
	assert.ok(!args.includes('--registry-username'));
	assert.ok(!args.includes('--registry-password'));
	assert.ok(args.includes('DATABASE_URL=secretref:database-url'));
	assert.ok(args.includes('ACCESS_TOKEN_SECRET=secretref:access-token-secret'));
	assert.ok(
		args.includes('database-url=postgresql://app:secret@db.example.com/app?sslmode=verify-full')
	);
	assert.ok(args.includes('access-token-secret=access'));
	const secretsStart = args.indexOf('--secrets') + 1;
	const secretsEnd = args.indexOf('--env-vars');
	for (const secret of args.slice(secretsStart, secretsEnd)) {
		const [secretName] = secret.split('=', 1);
		assert.match(secretName, /^[a-z0-9](?:[a-z0-9-]{0,18}[a-z0-9])?$/u);
		assert.ok(secretName.length <= 20);
	}
	assert.ok(
		args.includes(
			'OTEL_RESOURCE_ATTRIBUTES=service.namespace=nrg-commerce,deployment.environment.name=production'
		)
	);

	const defaults = buildCreateArguments(
		parseApiDeploymentEnvironment(deploymentEnvironment, image, 'staging'),
		{}
	);
	assert.ok(defaults.includes('NODE_ENV=production'));
	assert.ok(defaults.includes('PORT=8080'));
});

test('ensureAzureInfrastructure creates missing Azure resources once with compatible environment arguments', async () => {
	const config = parseApiDeploymentEnvironment(deploymentEnvironment, image, 'production');
	const calls = [];
	let groupExists = false;
	let environmentExists = false;
	const notFound = () =>
		Object.assign(new Error('ResourceNotFound'), { stderr: 'ResourceNotFound' });
	const run = async (command, args) => {
		calls.push([command, args]);
		if (command === 'az' && args[0] === 'group' && args[1] === 'show') {
			if (!groupExists) throw notFound();
			return json({ name: config.resourceGroup, location: config.location });
		}
		if (command === 'az' && args[0] === 'group' && args[1] === 'create') {
			groupExists = true;
			return { stdout: '' };
		}
		if (command === 'az' && args[0] === 'containerapp' && args[1] === 'env' && args[2] === 'show') {
			if (!environmentExists) throw notFound();
			return json({ name: config.containerAppEnvironment, location: config.location });
		}
		if (
			command === 'az' &&
			args[0] === 'containerapp' &&
			args[1] === 'env' &&
			args[2] === 'create'
		) {
			environmentExists = true;
			return { stdout: '' };
		}
		throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
	};

	await ensureAzureInfrastructure(run, config);
	await ensureAzureInfrastructure(run, config);

	const groupCreates = calls.filter(([, args]) => args[0] === 'group' && args[1] === 'create');
	assert.equal(groupCreates.length, 1);
	assert.ok(groupCreates[0][1].includes(config.location));
	const environmentCreates = calls.filter(
		([, args]) => args[0] === 'containerapp' && args[1] === 'env' && args[2] === 'create'
	);
	assert.equal(environmentCreates.length, 1);
	assert.ok(!environmentCreates[0][1].includes('--environment-mode'));
	assert.ok(!environmentCreates[0][1].includes('ConsumptionOnly'));
	assert.ok(environmentCreates[0][1].includes('--logs-destination'));
	assert.ok(environmentCreates[0][1].includes('none'));
});

test('buildTemplatePatch replaces runtime environment values and adds health probes', () => {
	const current = {
		properties: {
			template: {
				containers: [
					{
						name: 'api',
						image: 'old',
						env: [{ name: 'DATABASE_URL', secretRef: 'DATABASE_URL' }]
					}
				],
				scale: { minReplicas: 1, maxReplicas: 3 }
			}
		}
	};
	const patch = buildTemplatePatch(current, image, 'api-aaaaaaaaaaaa', deploymentEnvironment);
	const container = patch.properties.template.containers[0];

	assert.equal(container.image, image);
	assert.ok(
		container.env.some((entry) => entry.name === 'NODE_ENV' && entry.value === 'production')
	);
	assert.ok(container.env.some((entry) => entry.name === 'PORT' && entry.value === '8080'));
	assert.ok(
		container.env.some(
			(entry) => entry.name === 'DATABASE_URL' && entry.secretRef === 'database-url'
		)
	);
	assert.ok(!container.env.some((entry) => entry.secretRef === 'DATABASE_URL'));
	assert.equal(container.resources.cpu, 0.25);
	assert.equal(container.resources.memory, '0.5Gi');
	assert.deepEqual(
		container.probes.map((probe) => [probe.type, probe.httpGet.path]),
		[
			['Liveness', '/health/liveness'],
			['Readiness', '/health/readiness']
		]
	);
	assert.equal(patch.properties.template.scale.minReplicas, 0);
	assert.equal(patch.properties.template.scale.maxReplicas, 1);
	assert.throws(() => buildTemplatePatch({}, image, 'api-aaaaaaaaaaaa'), /no deployable/u);
	const fallbackPatch = buildTemplatePatch(
		{
			properties: {
				template: {
					containers: [{ name: 'worker', image: 'old' }]
				}
			}
		},
		image,
		'api-bbbbbbbbbbbb',
		deploymentEnvironment
	);
	assert.equal(fallbackPatch.properties.template.containers[0].image, image);
});

test('fetchCloudflareIpv4Cidrs validates, deduplicates, and sorts the official response', async () => {
	const cidrs = await fetchCloudflareIpv4Cidrs(
		async () =>
			new Response(
				JSON.stringify({
					success: true,
					result: { ipv4_cidrs: ['192.0.2.0/24', '198.51.100.0/24', '192.0.2.0/24'] }
				}),
				{ status: 200 }
			)
	);
	assert.deepEqual(cidrs, ['192.0.2.0/24', '198.51.100.0/24']);
	await assert.rejects(
		() => fetchCloudflareIpv4Cidrs(async () => new Response('{}', { status: 503 })),
		/HTTP 503/u
	);
	await assert.rejects(
		() =>
			fetchCloudflareIpv4Cidrs(
				async () => new Response(JSON.stringify({ success: true }), { status: 200 })
			),
		/no IPv4 CIDRs/u
	);
	await assert.rejects(
		() =>
			fetchCloudflareIpv4Cidrs(
				async () =>
					new Response(
						JSON.stringify({ success: true, result: { ipv4_cidrs: ['999.0.0.0/24'] } }),
						{ status: 200 }
					)
			),
		/invalid IPv4 CIDR/u
	);
});

test('reconcileIngressRules fails on unmanaged rules and removes stale managed ranges', async () => {
	const config = parseApiDeploymentEnvironment(deploymentEnvironment, image, 'production');
	const calls = [];
	const run = async (command, args) => {
		calls.push([command, args]);
		if (args.includes('access-restriction') && args.includes('list')) {
			return json({
				value: [
					{
						name: 'nrg-cloudflare-stale',
						properties: { action: 'Allow', ipAddressRange: '203.0.113.0/24' }
					}
				]
			});
		}
		return { stdout: '' };
	};

	await reconcileIngressRules({ run, config, cidrs: ['192.0.2.0/24'] });
	assert.ok(calls.some(([, args]) => args.includes('remove')));

	await assert.rejects(
		() =>
			reconcileIngressRules({
				run: async (command, args) =>
					args.includes('list')
						? json({
								value: [
									{
										name: 'operator-rule',
										properties: { action: 'Allow', ipAddressRange: '192.0.2.0/24' }
									}
								]
							})
						: { stdout: '' },
				config,
				cidrs: ['192.0.2.0/24']
			}),
		/Unexpected unmanaged/u
	);

	const existingName = ruleNameForCidr('192.0.2.0/24');
	const existingRun = async (command, args) =>
		args.includes('list')
			? json([
					{
						ruleName: existingName,
						ipAddress: '192.0.2.0/24',
						action: 'Allow'
					}
				])
			: { stdout: '' };
	assert.deepEqual(
		await reconcileIngressRules({ run: existingRun, config, cidrs: ['192.0.2.0/24'] }),
		[existingName]
	);
});

test('reconcileIngressRules retries mutations after Azure finishes active provisioning', async () => {
	const config = parseApiDeploymentEnvironment(deploymentEnvironment, image, 'production');
	let setAttempts = 0;
	let showAttempts = 0;
	const run = async (command, args) => {
		if (command === 'az' && args.includes('access-restriction') && args.includes('list')) {
			return json({ value: [] });
		}
		if (command === 'az' && args.includes('access-restriction') && args.includes('set')) {
			setAttempts += 1;
			if (setAttempts === 1) {
				throw Object.assign(new Error('Container App operation in progress'), {
					stderr:
						'ERROR: (ContainerAppOperationInProgress) Cannot modify a container app because there is an active provisioning operation in progress.'
				});
			}
			return { stdout: '' };
		}
		if (command === 'az' && args[0] === 'containerapp' && args[1] === 'show') {
			showAttempts += 1;
			return json({
				properties: { provisioningState: showAttempts === 1 ? 'InProgress' : 'Succeeded' }
			});
		}
		throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
	};

	await reconcileIngressRules({
		run,
		config,
		cidrs: ['192.0.2.0/24'],
		waitOptions: { intervalMs: 0, timeoutMs: 1000 }
	});

	assert.equal(setAttempts, 2);
	assert.equal(showAttempts, 2);
});

test('deployApi promotes a healthy new revision after migrations and DNS reconciliation', async () => {
	const originalArgv = process.argv;
	process.argv = ['node', 'deploy-api.mjs', '--environment', 'production', '--image', image];
	const calls = [];
	let showCount = 0;
	const app = {
		id: '/subscriptions/sub/resourceGroups/nrg-commerce/providers/Microsoft.App/containerApps/nrg-commerce-api',
		properties: {
			latestRevisionName: 'api-old',
			customDomainVerificationId: 'verification',
			configuration: { ingress: { fqdn: 'origin.azurecontainerapps.io' } },
			template: {
				containers: [
					{ name: 'api', image: 'old', env: [{ name: 'DATABASE_URL', secretRef: 'DATABASE_URL' }] }
				],
				scale: { minReplicas: 1, maxReplicas: 2 }
			}
		}
	};
	const run = async (command, args) => {
		calls.push([command, args]);
		if (command === 'az' && args.includes('revision') && args.includes('show'))
			return json({ properties: { runningState: 'Running', healthState: 'Healthy' } });
		if (command === 'az' && args[0] === 'group' && args[1] === 'show') {
			return json({ name: deploymentEnvironment.AZURE_RESOURCE_GROUP, location: 'eastasia' });
		}
		if (command === 'az' && args[0] === 'containerapp' && args[1] === 'env' && args[2] === 'show') {
			return json({
				name: deploymentEnvironment.AZURE_CONTAINER_APP_ENVIRONMENT,
				location: 'eastasia'
			});
		}
		if (command === 'az' && args[0] === 'containerapp' && args[1] === 'show') {
			showCount += 1;
			return json({
				...app,
				properties: { ...app.properties, latestRevisionName: showCount > 2 ? 'api-new' : 'api-old' }
			});
		}
		if (command === 'az' && args.includes('access-restriction') && args.includes('list'))
			return json({ value: [] });
		if (command === 'az' && args.includes('hostname') && args.includes('list')) return json([]);
		if (command === 'terraform' && args.includes('state')) return { stdout: '' };
		return { stdout: '' };
	};
	const fetcher = async (input) => {
		if (input.toString().endsWith('/ips')) {
			return new Response(
				JSON.stringify({ success: true, result: { ipv4_cidrs: ['192.0.2.0/24'] } }),
				{ status: 200 }
			);
		}
		return new Response(JSON.stringify({ success: true, result: [] }), { status: 200 });
	};

	try {
		const result = await deployApi({
			environment: {
				...deploymentEnvironment,
				HCP_TERRAFORM_TOKEN: 'hcp',
				CLOUDFLARE_API_TOKEN: 'token'
			},
			run,
			fetcher,
			waitOptions: { intervalMs: 0, timeoutMs: 1000 }
		});
		assert.equal(result.revision, 'api-new');
		assert.ok(calls.some(([, args]) => args.includes('traffic')));
		assert.ok(calls.some(([, args]) => args.includes('rest')));
		const secretSet = calls.find(
			([command, args]) => command === 'az' && args.includes('secret') && args.includes('set')
		);
		assert.ok(secretSet);
		assert.ok(secretSet[1].includes('access-token-secret=access'));
		const terraformInit = calls.find(
			([command, args]) => command === 'terraform' && args.includes('init')
		);
		assert.ok(terraformInit);
		assert.ok(terraformInit[1].includes('-lockfile=readonly'));
		const terraformApply = calls.find(
			([command, args]) => command === 'terraform' && args.includes('apply')
		);
		assert.ok(terraformApply);
		assert.ok(!terraformApply[1].includes('-auto-approve'));
		const bindCall = calls.find(([, args]) => args.includes('hostname') && args.includes('bind'));
		assert.ok(bindCall);
		assert.ok(!bindCall[1].includes('--certificate'));
	} finally {
		process.argv = originalArgv;
	}
});
