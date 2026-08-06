import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

import { importExistingApiDnsRecords } from './import-api-dns.mjs';

const execFile = promisify(execFileCallback);
const terraformDirectory = 'infra/api-dns';
const azureApiVersion = '2025-07-01';
const managedRulePrefix = 'nrg-cloudflare-';
const runtimeSecretVariables = [
	'DATABASE_URL',
	'ACCESS_TOKEN_SECRET',
	'REFRESH_TOKEN_SECRET',
	'PENDING_TOKEN_SECRET',
	'DATA_ENCRYPTION_SECRET',
	'R2_ACCESS_KEY_ID',
	'R2_SECRET_ACCESS_KEY',
	'OTEL_EXPORTER_OTLP_HEADERS'
];
const runtimeVariables = [
	'NODE_ENV',
	'PORT',
	'TRUST_PROXY_HOPS',
	'CORS_ORIGINS',
	'BODY_LIMIT',
	'LOG_LEVEL',
	'COOKIE_SECURE',
	'COOKIE_SAME_SITE',
	'DATABASE_MAX_CONNECTIONS',
	'JWT_ISSUER',
	'JWT_AUDIENCE',
	'ACCESS_TOKEN_TTL_SECONDS',
	'REFRESH_TOKEN_TTL_SECONDS',
	'PENDING_TOKEN_TTL_SECONDS',
	'SESSION_TTL_SECONDS',
	'SESSION_ABSOLUTE_TTL_SECONDS',
	'TOTP_ISSUER',
	'WEBAUTHN_RP_ID',
	'WEBAUTHN_RP_NAME',
	'WEBAUTHN_ORIGIN',
	'RATE_LIMIT_WINDOW_MS',
	'RATE_LIMIT_MAX',
	'AUTH_RATE_LIMIT_MAX',
	'R2_ACCOUNT_ID',
	'R2_BUCKET_NAME',
	'R2_UPLOAD_BUCKET_NAME',
	'R2_PUBLIC_BASE_URL',
	'R2_ASSET_KEY_PREFIX',
	'R2_UPLOAD_URL_TTL_SECONDS',
	'STOREFRONT_CACHE_TTL_SECONDS',
	'STOREFRONT_CACHE_MAX_ENTRIES',
	'OTEL_EXPORTER_OTLP_ENDPOINT',
	'OTEL_SERVICE_NAME',
	'OTEL_RESOURCE_ATTRIBUTES',
	'OTEL_METRIC_EXPORT_INTERVAL_MS'
];

const defaultRuntimeValues = {
	NODE_ENV: 'production',
	PORT: '8080'
};

const azureSecretNames = {
	DATABASE_URL: 'database-url',
	ACCESS_TOKEN_SECRET: 'access-token-secret',
	REFRESH_TOKEN_SECRET: 'refresh-token-secret',
	PENDING_TOKEN_SECRET: 'pending-token-secret',
	DATA_ENCRYPTION_SECRET: 'data-encryption',
	R2_ACCESS_KEY_ID: 'r2-access-key-id',
	R2_SECRET_ACCESS_KEY: 'r2-secret-key',
	OTEL_EXPORTER_OTLP_HEADERS: 'otel-headers'
};

function azureSecretName(name) {
	const secretName = azureSecretNames[name];
	if (!secretName) throw new Error(`No Azure secret alias is configured for ${name}.`);
	return secretName;
}

export async function defaultRun(command, args, options = {}) {
	return execFile(command, args, { ...options, maxBuffer: 8 * 1024 * 1024 });
}

function required(environment, name) {
	const value = environment[name]?.trim();
	if (!value) throw new Error(`${name} is required.`);
	return value;
}

function parseArguments(argv) {
	const imageIndex = argv.indexOf('--image');
	const environmentIndex = argv.indexOf('--environment');
	if (imageIndex < 0 || environmentIndex < 0) {
		throw new Error(
			'Usage: deploy-api.mjs --environment <staging|production> --image <digest-ref>'
		);
	}

	return {
		environmentName: required({ value: argv[environmentIndex + 1] }, 'value'),
		image: required({ value: argv[imageIndex + 1] }, 'value')
	};
}

export function parseApiDeploymentEnvironment(environment, image, environmentName) {
	if (!/^ghcr\.io\/[^\s]+@sha256:[a-f0-9]{64}$/u.test(image)) {
		throw new Error('API image must be an immutable GHCR sha256 digest reference.');
	}
	if (!['staging', 'production'].includes(environmentName)) {
		throw new Error('API deployment environment must be staging or production.');
	}

	const revisionIdentity = createHash('sha256')
		.update(
			JSON.stringify({
				image,
				runtime: runtimeVariables.map((name) => [
					name,
					environment[name]?.trim() || defaultRuntimeValues[name] || null
				]),
				secrets: runtimeSecretVariables.map((name) => [name, environment[name]?.trim() || null])
			})
		)
		.digest('hex');
	return {
		environmentName,
		image,
		revisionSuffix: `api-${revisionIdentity.slice(0, 12)}`,
		resourceGroup: required(environment, 'AZURE_RESOURCE_GROUP'),
		location: required(environment, 'AZURE_LOCATION').toLowerCase(),
		containerAppEnvironment: required(environment, 'AZURE_CONTAINER_APP_ENVIRONMENT'),
		containerAppName: required(environment, 'AZURE_CONTAINER_APP_NAME'),
		apiDomain: required(environment, 'API_DOMAIN').toLowerCase(),
		originCertificateName: `api-origin-${environmentName}`,
		originCertificatePfxBase64: required(environment, 'API_ORIGIN_CERTIFICATE_PFX_BASE64'),
		originCertificatePassword: required(environment, 'API_ORIGIN_CERTIFICATE_PASSWORD'),
		zoneId: required(environment, 'CLOUDFLARE_ZONE_ID'),
		dnsWorkspace: required(environment, 'API_DNS_TF_WORKSPACE'),
		terraformOrganization: required(environment, 'TF_CLOUD_ORGANIZATION'),
		terraformProject: required(environment, 'TF_CLOUD_PROJECT')
	};
}

function buildRuntimeEnvTemplate(environment) {
	const values = [];
	for (const name of runtimeVariables) {
		const value = environment[name]?.trim() || defaultRuntimeValues[name];
		if (value) values.push({ name, value });
	}
	for (const name of runtimeSecretVariables) {
		if (!environment[name]?.trim()) continue;
		values.push({ name, secretRef: azureSecretName(name) });
	}
	return values;
}

function buildRuntimeEnvArguments(environment) {
	return buildRuntimeEnvTemplate(environment).map((entry) =>
		entry.secretRef ? `${entry.name}=secretref:${entry.secretRef}` : `${entry.name}=${entry.value}`
	);
}

function buildSecretArguments(environment) {
	return runtimeSecretVariables
		.filter((name) => environment[name]?.trim())
		.map((name) => `${azureSecretName(name)}=${environment[name].trim()}`);
}

export function buildCreateArguments(config, environment) {
	const args = [
		'containerapp',
		'create',
		'--name',
		config.containerAppName,
		'--resource-group',
		config.resourceGroup,
		'--environment',
		config.containerAppEnvironment,
		'--image',
		config.image,
		'--target-port',
		'8080',
		'--ingress',
		'external',
		'--transport',
		'auto',
		'--min-replicas',
		'0',
		'--max-replicas',
		'1',
		'--cpu',
		'0.25',
		'--memory',
		'0.5Gi',
		'--revisions-mode',
		'multiple',
		'--revision-suffix',
		config.revisionSuffix
	];
	const secrets = buildSecretArguments(environment);
	const runtimeEnv = buildRuntimeEnvArguments(environment);
	if (secrets.length > 0) args.push('--secrets', ...secrets);
	if (runtimeEnv.length > 0) args.push('--env-vars', ...runtimeEnv);
	args.push('--output', 'none');
	return args;
}

const probes = [
	{
		type: 'Liveness',
		httpGet: { path: '/health/liveness', port: 8080, scheme: 'HTTP' },
		initialDelaySeconds: 10,
		periodSeconds: 30,
		timeoutSeconds: 5,
		failureThreshold: 3,
		successThreshold: 1
	},
	{
		type: 'Readiness',
		httpGet: { path: '/health/readiness', port: 8080, scheme: 'HTTP' },
		initialDelaySeconds: 10,
		periodSeconds: 10,
		timeoutSeconds: 5,
		failureThreshold: 6,
		successThreshold: 1
	}
];

const templatePropertyNames = new Set([
	'containers',
	'initContainers',
	'revisionSuffix',
	'scale',
	'serviceBinds',
	'terminationGracePeriodSeconds',
	'volumes'
]);
const containerPropertyNames = new Set([
	'args',
	'command',
	'env',
	'image',
	'name',
	'probes',
	'resources',
	'volumeMounts'
]);
const initContainerPropertyNames = new Set([
	'args',
	'command',
	'env',
	'image',
	'name',
	'resources',
	'volumeMounts'
]);

function pickProperties(value, propertyNames) {
	if (!value || typeof value !== 'object') return value;
	return Object.fromEntries(Object.entries(value).filter(([key]) => propertyNames.has(key)));
}

export function buildTemplatePatch(current, image, revisionSuffix, environment = {}) {
	const currentTemplate = current?.properties?.template;
	const template = pickProperties(currentTemplate, templatePropertyNames);
	if (Array.isArray(template?.containers)) {
		template.containers = template.containers.map((container) =>
			pickProperties(container, containerPropertyNames)
		);
	}
	if (Array.isArray(template?.initContainers)) {
		template.initContainers = template.initContainers.map((container) =>
			pickProperties(container, initContainerPropertyNames)
		);
	}
	if (!template || !Array.isArray(template.containers) || template.containers.length === 0) {
		throw new Error('Azure Container App has no deployable container template.');
	}
	const containerIndex = Math.max(
		template.containers.findIndex((container) => container.name === 'api'),
		0
	);
	const containers = template.containers.map((container, index) => {
		if (index !== containerIndex) return container;
		return {
			...container,
			image,
			env: buildRuntimeEnvTemplate(environment),
			resources: { ...container.resources, cpu: 0.25, memory: '0.5Gi' },
			probes
		};
	});
	return {
		properties: {
			template: {
				...template,
				revisionSuffix,
				containers,
				scale: { ...template.scale, minReplicas: 0, maxReplicas: 1 }
			}
		}
	};
}

async function runJson(run, command, args, options) {
	const result = await run(command, [...args, '--output', 'json'], options);
	try {
		return JSON.parse(result.stdout ?? '');
	} catch {
		throw new Error(`${command} returned invalid JSON.`);
	}
}

function isMissingAzureResource(error) {
	const message = `${error?.stderr ?? ''} ${error?.message ?? ''}`;
	return /not found|could not be found|ResourceNotFound|ResourceGroupNotFound/iu.test(message);
}

function isContainerAppOperationInProgress(error) {
	const message = `${error?.stderr ?? ''} ${error?.message ?? ''}`;
	return /ContainerAppOperationInProgress|active provisioning operation/iu.test(message);
}

async function showResourceGroup(run, config) {
	try {
		return await runJson(run, 'az', ['group', 'show', '--name', config.resourceGroup]);
	} catch (error) {
		if (isMissingAzureResource(error)) return null;
		throw error;
	}
}

async function showContainerAppEnvironment(run, config) {
	try {
		return await runJson(run, 'az', [
			'containerapp',
			'env',
			'show',
			'--name',
			config.containerAppEnvironment,
			'--resource-group',
			config.resourceGroup
		]);
	} catch (error) {
		if (isMissingAzureResource(error)) return null;
		throw error;
	}
}

export async function ensureAzureInfrastructure(run, config) {
	let resourceGroup = await showResourceGroup(run, config);
	if (!resourceGroup) {
		await run('az', [
			'group',
			'create',
			'--name',
			config.resourceGroup,
			'--location',
			config.location,
			'--output',
			'none'
		]);
		resourceGroup = await showResourceGroup(run, config);
		if (!resourceGroup) throw new Error('Azure resource group was not available after creation.');
	}

	let containerAppEnvironment = await showContainerAppEnvironment(run, config);
	if (!containerAppEnvironment) {
		await run('az', [
			'containerapp',
			'env',
			'create',
			'--name',
			config.containerAppEnvironment,
			'--resource-group',
			config.resourceGroup,
			'--location',
			config.location,
			'--logs-destination',
			'none',
			'--output',
			'none'
		]);
		containerAppEnvironment = await showContainerAppEnvironment(run, config);
		if (!containerAppEnvironment) {
			throw new Error('Azure Container Apps environment was not available after creation.');
		}
	}

	return { resourceGroup, containerAppEnvironment };
}

async function showContainerApp(run, config) {
	try {
		return await runJson(run, 'az', [
			'containerapp',
			'show',
			'--name',
			config.containerAppName,
			'--resource-group',
			config.resourceGroup
		]);
	} catch (error) {
		if (isMissingAzureResource(error)) return null;
		throw error;
	}
}

async function reconcileRuntimeSecrets(run, config, environment) {
	const secrets = buildSecretArguments(environment);
	if (secrets.length === 0) return;
	await runContainerAppMutation(run, config, [
		'containerapp',
		'secret',
		'set',
		'--name',
		config.containerAppName,
		'--resource-group',
		config.resourceGroup,
		'--secrets',
		...secrets,
		'--output',
		'none'
	]);
}

async function patchContainerTemplate(run, app, config, environment) {
	const payload = buildTemplatePatch(app, config.image, config.revisionSuffix, environment);
	const directory = await mkdtemp(join(tmpdir(), 'nrg-api-patch-'));
	const payloadPath = join(directory, 'payload.json');
	await writeFile(payloadPath, JSON.stringify(payload), { mode: 0o600 });
	try {
		await runContainerAppMutation(run, config, [
			'rest',
			'--method',
			'patch',
			'--url',
			`https://management.azure.com${app.id}?api-version=${azureApiVersion}`,
			'--body',
			`@${payloadPath}`,
			'--output',
			'none'
		]);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

async function ensureContainerApp(run, config, environment) {
	const existing = await showContainerApp(run, config);
	const previousRevision = existing?.properties?.latestRevisionName ?? null;
	if (!existing) {
		await run('az', buildCreateArguments(config, environment));
	}
	const current = (await showContainerApp(run, config)) ?? existing;
	if (!current) throw new Error('Azure Container App was not available after creation.');
	await reconcileRuntimeSecrets(run, config, environment);
	await patchContainerTemplate(run, current, config, environment);
	await waitForContainerAppProvisioning(run, config);
	const deployed = await showContainerApp(run, config);
	if (!deployed) throw new Error('Azure Container App disappeared after deployment.');
	const revision = deployed.properties?.latestRevisionName;
	if (!revision) throw new Error('Azure did not report the deployed revision name.');
	return {
		app: deployed,
		previousRevision,
		revision
	};
}

function getIngressRuleValues(rule) {
	const properties = rule?.properties ?? rule;
	return {
		name: rule?.name ?? properties?.ruleName ?? rule?.ruleName ?? '',
		cidr: properties?.ipAddressRange ?? properties?.ipAddress ?? rule?.ipAddressRange ?? '',
		action: properties?.action ?? rule?.action ?? ''
	};
}

export function ruleNameForCidr(cidr) {
	return `${managedRulePrefix}${createHash('sha256').update(cidr).digest('hex').slice(0, 12)}`;
}

export async function fetchCloudflareIpv4Cidrs(fetcher = fetch) {
	const response = await fetcher('https://api.cloudflare.com/client/v4/ips');
	if (!response.ok) throw new Error(`Cloudflare IP list failed with HTTP ${response.status}.`);
	const payload = await response.json();
	const cidrs = payload?.result?.ipv4_cidrs;
	if (!payload?.success || !Array.isArray(cidrs) || cidrs.length === 0) {
		throw new Error('Cloudflare IP list returned no IPv4 CIDRs.');
	}
	if (
		!cidrs.every((cidr) => {
			const [address, prefix] = cidr.split('/');
			const prefixLength = Number(prefix);
			return (
				isIP(address) === 4 &&
				Number.isInteger(prefixLength) &&
				prefixLength >= 0 &&
				prefixLength <= 32
			);
		})
	) {
		throw new Error('Cloudflare IP list contains an invalid IPv4 CIDR.');
	}
	return [...new Set(cidrs)].sort();
}

async function waitForContainerAppProvisioning(run, config, options = {}) {
	const intervalMs = options.intervalMs ?? 10_000;
	const timeoutMs = options.timeoutMs ?? 10 * 60_000;
	const sleep =
		options.sleep ??
		((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
	const startedAt = Date.now();

	while (Date.now() - startedAt <= timeoutMs) {
		const app = await showContainerApp(run, config);
		if (!app) throw new Error('Azure Container App disappeared while waiting for provisioning.');
		const provisioningState = app.properties?.provisioningState;
		if (!provisioningState || provisioningState === 'Succeeded') return app;
		if (['Failed', 'Canceled', 'Deleting'].includes(provisioningState)) {
			throw new Error(`Azure Container App provisioning entered ${provisioningState}.`);
		}
		await sleep(intervalMs);
	}

	throw new Error('Timed out waiting for Azure Container App provisioning to complete.');
}

async function runContainerAppMutation(run, config, args, options = {}) {
	const timeoutMs = options.timeoutMs ?? 10 * 60_000;
	const startedAt = Date.now();
	let lastOperationError;

	while (Date.now() - startedAt <= timeoutMs) {
		try {
			return await run('az', args);
		} catch (error) {
			if (!isContainerAppOperationInProgress(error)) throw error;
			lastOperationError = error;
			const remainingMs = Math.max(timeoutMs - (Date.now() - startedAt), 0);
			await waitForContainerAppProvisioning(run, config, {
				...options,
				timeoutMs: remainingMs
			});
		}
	}

	throw new Error('Timed out waiting to modify Azure Container App ingress.', {
		cause: lastOperationError
	});
}

export async function reconcileIngressRules({ run, config, cidrs, waitOptions }) {
	const listed = await runJson(run, 'az', [
		'containerapp',
		'ingress',
		'access-restriction',
		'list',
		'--name',
		config.containerAppName,
		'--resource-group',
		config.resourceGroup
	]);
	const existing = (Array.isArray(listed) ? listed : (listed?.value ?? [])).map(
		getIngressRuleValues
	);
	for (const rule of existing) {
		if (!rule.name.startsWith(managedRulePrefix) || rule.action.toLowerCase() !== 'allow') {
			throw new Error(`Unexpected unmanaged Azure ingress rule: ${rule.name || '<unnamed>'}.`);
		}
	}

	const desiredNames = new Set(cidrs.map(ruleNameForCidr));
	for (const cidr of cidrs) {
		const name = ruleNameForCidr(cidr);
		const current = existing.find((rule) => rule.name === name && rule.cidr === cidr);
		if (current) continue;
		await runContainerAppMutation(
			run,
			config,
			[
				'containerapp',
				'ingress',
				'access-restriction',
				'set',
				'--name',
				config.containerAppName,
				'--resource-group',
				config.resourceGroup,
				'--rule-name',
				name,
				'--ip-address',
				cidr,
				'--action',
				'Allow',
				'--description',
				'Cloudflare IPv4 origin range managed by CI.',
				'--output',
				'none'
			],
			waitOptions
		);
	}
	for (const rule of existing) {
		if (!desiredNames.has(rule.name)) {
			await runContainerAppMutation(
				run,
				config,
				[
					'containerapp',
					'ingress',
					'access-restriction',
					'remove',
					'--name',
					config.containerAppName,
					'--resource-group',
					config.resourceGroup,
					'--rule-name',
					rule.name,
					'--output',
					'none'
				],
				waitOptions
			);
		}
	}
	return [...desiredNames];
}

async function listBoundHostnames(run, config) {
	const result = await runJson(run, 'az', [
		'containerapp',
		'hostname',
		'list',
		'--name',
		config.containerAppName,
		'--resource-group',
		config.resourceGroup
	]);
	return Array.isArray(result) ? result : (result?.value ?? []);
}

async function uploadOriginCertificate(run, config) {
	const directory = await mkdtemp(join(tmpdir(), 'nrg-api-origin-cert-'));
	const certificatePath = join(directory, 'origin.pfx');
	try {
		const certificate = Buffer.from(config.originCertificatePfxBase64, 'base64');
		if (certificate.length === 0) {
			throw new Error('API_ORIGIN_CERTIFICATE_PFX_BASE64 must decode to a non-empty certificate.');
		}
		await writeFile(certificatePath, certificate, { mode: 0o600 });
		await run('az', [
			'containerapp',
			'env',
			'certificate',
			'upload',
			'--name',
			config.containerAppEnvironment,
			'--resource-group',
			config.resourceGroup,
			'--certificate-file',
			certificatePath,
			'--password',
			config.originCertificatePassword,
			'--certificate-name',
			config.originCertificateName,
			'--output',
			'none'
		]);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

async function bindCustomDomain(run, config) {
	const hostnames = await listBoundHostnames(run, config);
	const existing = hostnames.find(
		(hostname) => (hostname.name ?? hostname.hostname ?? '').toLowerCase() === config.apiDomain
	);

	if (!existing) {
		await run('az', [
			'containerapp',
			'hostname',
			'add',
			'--name',
			config.containerAppName,
			'--resource-group',
			config.resourceGroup,
			'--hostname',
			config.apiDomain,
			'--output',
			'none'
		]);
	}

	await run('az', [
		'containerapp',
		'hostname',
		'bind',
		'--name',
		config.containerAppName,
		'--resource-group',
		config.resourceGroup,
		'--hostname',
		config.apiDomain,
		'--environment',
		config.containerAppEnvironment,
		'--certificate',
		config.originCertificateName,
		'--validation-method',
		'CNAME',
		'--output',
		'none'
	]);
	return true;
}

function terraformEnvironment(config, environment, proxied) {
	return {
		...environment,
		TF_WORKSPACE: config.dnsWorkspace,
		TF_VAR_cloudflare_zone_id: config.zoneId,
		TF_VAR_api_domain: config.apiDomain,
		TF_VAR_container_app_hostname: config.containerAppHostname,
		TF_VAR_custom_domain_verification_id: config.verificationId,
		TF_VAR_environment: config.environmentName,
		TF_VAR_proxied: String(proxied)
	};
}

async function applyApiDns(run, config, environment, proxied, fetcher) {
	const tfEnvironment = terraformEnvironment(config, environment, proxied);
	const tfRun = (command, args) => run(command, args, { env: tfEnvironment });
	await tfRun('terraform', [
		'-chdir=' + terraformDirectory,
		'init',
		'-input=false',
		'-lockfile=readonly'
	]);
	await importExistingApiDnsRecords({ environment: tfEnvironment, fetcher, run: tfRun });
	await tfRun('terraform', [
		'-chdir=' + terraformDirectory,
		'plan',
		'-input=false',
		'-lock-timeout=5m',
		'-out=deployment.tfplan'
	]);
	await tfRun('terraform', [
		'-chdir=' + terraformDirectory,
		'apply',
		'-input=false',
		'-lock-timeout=5m',
		'deployment.tfplan'
	]);
}

async function waitForRevision(run, config, revision, options = {}) {
	const intervalMs = options.intervalMs ?? 10_000;
	const timeoutMs = options.timeoutMs ?? 10 * 60_000;
	const sleep =
		options.sleep ??
		((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
	const startedAt = Date.now();

	while (Date.now() - startedAt <= timeoutMs) {
		const result = await runJson(run, 'az', [
			'containerapp',
			'revision',
			'show',
			'--name',
			config.containerAppName,
			'--resource-group',
			config.resourceGroup,
			'--revision',
			revision
		]);
		const properties = result?.properties ?? result;
		if (
			properties?.runningState === 'Running' &&
			['Healthy', 'Running'].includes(properties.healthState)
		) {
			return result;
		}
		if (
			['Failed', 'Degraded'].includes(properties?.runningState) ||
			properties?.healthState === 'Unhealthy'
		) {
			throw new Error(`Azure revision ${revision} did not become healthy.`);
		}
		await sleep(intervalMs);
	}

	throw new Error(`Timed out waiting for Azure revision ${revision} to become healthy.`);
}

async function setTraffic(run, config, revisionWeights) {
	await run('az', [
		'containerapp',
		'ingress',
		'traffic',
		'set',
		'--name',
		config.containerAppName,
		'--resource-group',
		config.resourceGroup,
		'--revision-weight',
		...revisionWeights.map(({ revision, weight }) => `${revision}=${weight}`),
		'--output',
		'none'
	]);
}

export async function deployApi({
	environment = process.env,
	run = defaultRun,
	fetcher = fetch,
	waitOptions
} = {}) {
	const { environmentName, image } = parseArguments(process.argv.slice(2));
	const config = parseApiDeploymentEnvironment(environment, image, environmentName);
	await ensureAzureInfrastructure(run, config);
	const deployment = await ensureContainerApp(run, config, environment);
	config.containerAppHostname = deployment.app.properties?.configuration?.ingress?.fqdn;
	config.verificationId = deployment.app.properties?.customDomainVerificationId;
	if (!config.containerAppHostname || !config.verificationId) {
		throw new Error('Azure did not report the ingress hostname and domain verification ID.');
	}

	const cidrs = await fetchCloudflareIpv4Cidrs(fetcher);
	await reconcileIngressRules({ run, config, cidrs, waitOptions });
	await applyApiDns(run, config, environment, true, fetcher);
	await uploadOriginCertificate(run, config);
	try {
		await bindCustomDomain(run, config);
	} catch (error) {
		if (!/DNS|CNAME|validation/iu.test(`${error?.message ?? ''} ${error?.stderr ?? ''}`)) {
			throw error;
		}
		await applyApiDns(run, config, environment, false, fetcher);
		try {
			await bindCustomDomain(run, config);
		} finally {
			await applyApiDns(run, config, environment, true, fetcher);
		}
	}

	if (deployment.previousRevision && deployment.previousRevision !== deployment.revision) {
		await setTraffic(run, config, [
			{ revision: deployment.previousRevision, weight: 100 },
			{ revision: deployment.revision, weight: 0 }
		]);
	}
	await waitForRevision(run, config, deployment.revision, waitOptions);
	const finalWeights = [{ revision: deployment.revision, weight: 100 }];
	if (deployment.previousRevision && deployment.previousRevision !== deployment.revision) {
		finalWeights.push({ revision: deployment.previousRevision, weight: 0 });
	}
	await setTraffic(run, config, finalWeights);

	return {
		revision: deployment.revision,
		containerAppHostname: config.containerAppHostname,
		apiDomain: config.apiDomain
	};
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	await deployApi();
	process.stdout.write('API Container App deployment completed.\n');
}
