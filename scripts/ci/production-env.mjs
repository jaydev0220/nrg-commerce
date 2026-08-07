import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';

const targets = new Set(['landing', 'catalog', 'contact', 'admin', 'api', 'infrastructure']);

function isLoopbackHostname(hostname) {
	return (
		hostname === 'localhost' ||
		hostname.endsWith('.localhost') ||
		hostname === '127.0.0.1' ||
		hostname === '[::1]'
	);
}

function required(environment, name, errors) {
	const value = environment[name]?.trim();
	if (!value) errors.push(`${name} is required.`);
	return value ?? '';
}

function secureUrl(environment, name, errors, rootOnly = false) {
	const value = required(environment, name, errors);
	if (!value) return '';
	try {
		const url = new URL(value);
		if (
			url.protocol !== 'https:' ||
			url.username ||
			url.password ||
			url.port ||
			isLoopbackHostname(url.hostname) ||
			url.search ||
			url.hash ||
			(rootOnly && (url.pathname !== '/' || value !== url.origin))
		)
			throw new Error('invalid URL');
		return rootOnly ? url.origin : value.replace(/\/+$/u, '');
	} catch {
		errors.push(`${name} must be an HTTPS URL${rootOnly ? ' without a path' : ''}.`);
		return '';
	}
}

function domain(environment, name, errors) {
	const value = required(environment, name, errors).toLowerCase();
	if (!value) return '';
	try {
		const url = new URL(`https://${value}`);
		if (
			url.hostname !== value ||
			url.port ||
			isLoopbackHostname(url.hostname) ||
			url.pathname !== '/' ||
			url.search ||
			url.hash
		) {
			throw new Error('invalid hostname');
		}
		return value;
	} catch {
		errors.push(`${name} must contain a hostname without scheme, port, path, query, or fragment.`);
		return '';
	}
}

function cloudflareId(environment, name, errors) {
	const value = required(environment, name, errors);
	if (value && !/^[0-9a-f]{32}$/u.test(value)) {
		errors.push(`${name} must be a 32-character lowercase hexadecimal ID.`);
	}
	return value;
}

function cloudflare(environment, errors) {
	const accountId = cloudflareId(environment, 'CLOUDFLARE_ACCOUNT_ID', errors);
	required(environment, 'CLOUDFLARE_API_TOKEN', errors);
	return { cloudflareAccountId: accountId };
}

function origins(environment, name, errors) {
	const value = required(environment, name, errors);
	if (!value) return [];
	const result = [];
	for (const raw of value
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean)) {
		try {
			const url = new URL(raw);
			if (
				url.protocol !== 'https:' ||
				url.username ||
				url.password ||
				url.port ||
				isLoopbackHostname(url.hostname) ||
				url.pathname !== '/' ||
				url.search ||
				url.hash ||
				raw !== url.origin
			) {
				throw new Error('invalid origin');
			}
			result.push(url.origin);
		} catch {
			errors.push(`${name} must contain only exact HTTPS origins.`);
		}
	}
	return result;
}

function cidrs(environment, name, errors) {
	const value = required(environment, name, errors);
	if (!value) return [];
	const result = [];
	for (const cidr of value
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean)) {
		const parts = cidr.split('/');
		const [address, prefix] = parts;
		const family = isIP(address ?? '');
		const max = family === 4 ? 32 : family === 6 ? 128 : -1;
		const length = Number(prefix);
		if (
			parts.length !== 2 ||
			max < 0 ||
			!prefix ||
			!Number.isInteger(length) ||
			length < 0 ||
			length > max
		) {
			errors.push(`${name} must contain valid IPv4/IPv6 CIDR ranges.`);
		} else result.push(cidr);
	}
	return [...new Set(result)];
}

function databaseUrl(environment, name, errors) {
	const value = required(environment, name, errors);
	if (!value) return '';
	try {
		const url = new URL(value);
		if (
			!['postgres:', 'postgresql:'].includes(url.protocol) ||
			!url.hostname ||
			isLoopbackHostname(url.hostname) ||
			!url.username ||
			!url.password ||
			!url.pathname.slice(1) ||
			url.hash ||
			url.searchParams.get('sslmode') !== 'verify-full'
		) {
			throw new Error('invalid database URL');
		}
	} catch {
		errors.push(`${name} must be a PostgreSQL URL with sslmode=verify-full.`);
	}
	return value;
}

function api(environment, errors) {
	const deploymentEnvironment = required(environment, 'DEPLOYMENT_ENVIRONMENT', errors);
	if (deploymentEnvironment !== 'production')
		errors.push('DEPLOYMENT_ENVIRONMENT must be production.');
	for (const name of [
		'AZURE_CLIENT_ID',
		'AZURE_TENANT_ID',
		'AZURE_SUBSCRIPTION_ID',
		'AZURE_RESOURCE_GROUP',
		'AZURE_LOCATION',
		'AZURE_CONTAINER_APP_ENVIRONMENT',
		'AZURE_CONTAINER_APP_NAME',
		'DATABASE_URL',
		'ACCESS_TOKEN_SECRET',
		'REFRESH_TOKEN_SECRET',
		'PENDING_TOKEN_SECRET',
		'DATA_ENCRYPTION_SECRET',
		'R2_ACCESS_KEY_ID',
		'R2_SECRET_ACCESS_KEY',
		'OTEL_RESOURCE_ATTRIBUTES'
	])
		required(environment, name, errors);
	cloudflareId(environment, 'CLOUDFLARE_ZONE_ID', errors);
	databaseUrl(environment, 'DATABASE_URL', errors);
	databaseUrl(environment, 'DIRECT_URL', errors);
	origins(environment, 'CORS_ORIGINS', errors);
	cidrs(environment, 'TRUSTED_PROXY_CIDRS', errors);
	secureUrl(environment, 'WEBAUTHN_ORIGIN', errors, true);
	secureUrl(environment, 'R2_PUBLIC_BASE_URL', errors, true);
	secureUrl(environment, 'OTEL_EXPORTER_OTLP_ENDPOINT', errors);
	domain(environment, 'API_DOMAIN', errors);
	return {
		deploymentEnvironment,
		apiDomain: environment.API_DOMAIN?.trim().toLowerCase() ?? '',
		azureResourceGroup: environment.AZURE_RESOURCE_GROUP?.trim() ?? '',
		azureLocation: environment.AZURE_LOCATION?.trim().toLowerCase() ?? '',
		azureContainerAppEnvironment: environment.AZURE_CONTAINER_APP_ENVIRONMENT?.trim() ?? '',
		azureContainerAppName: environment.AZURE_CONTAINER_APP_NAME?.trim() ?? ''
	};
}

function infrastructure(environment, errors) {
	const deploymentEnvironment = required(environment, 'DEPLOYMENT_ENVIRONMENT', errors);
	if (deploymentEnvironment !== 'production')
		errors.push('DEPLOYMENT_ENVIRONMENT must be production.');
	required(environment, 'TF_CLOUD_ORGANIZATION', errors);
	required(environment, 'TF_CLOUD_PROJECT', errors);
	required(environment, 'TF_WORKSPACE', errors);
	return {
		deploymentEnvironment,
		adminDomain: domain(environment, 'ADMIN_DOMAIN', errors),
		cloudflareZoneId: cloudflareId(environment, 'CLOUDFLARE_ZONE_ID', errors),
		hcpTerraformOrganization: required(environment, 'TF_CLOUD_ORGANIZATION', errors),
		hcpTerraformProject: required(environment, 'TF_CLOUD_PROJECT', errors),
		hcpTerraformWorkspace: required(environment, 'TF_WORKSPACE', errors),
		...cloudflare(environment, errors)
	};
}

function publicValues(environment, errors) {
	const landingSiteUrl = secureUrl(environment, 'LANDING_SITE_URL', errors, true);
	const landingDomain = domain(environment, 'LANDING_DOMAIN', errors);
	const catalogDomain = domain(environment, 'CATALOG_DOMAIN', errors);
	const contactDomain = domain(environment, 'CONTACT_DOMAIN', errors);
	if (landingSiteUrl && landingDomain && new URL(landingSiteUrl).hostname !== landingDomain) {
		errors.push('LANDING_DOMAIN must match LANDING_SITE_URL hostname.');
	}
	return {
		landingSiteUrl,
		landingDomain,
		catalogDomain,
		contactDomain,
		catalogUrl: catalogDomain ? `https://${catalogDomain}` : '',
		contactUrl: contactDomain ? `https://${contactDomain}` : '',
		cdnBaseUrl: secureUrl(environment, 'CDN_BASE_URL', errors, true),
		cookieDomain: domain(environment, 'COOKIE_DOMAIN', errors),
		facebookUrl: secureUrl(environment, 'FACEBOOK_URL', errors),
		lineUrl: secureUrl(environment, 'LINE_URL', errors),
		turnstileSiteKey: required(environment, 'TURNSTILE_SITE_KEY', errors)
	};
}

export function validateProductionEnvironment(target, environment) {
	if (!targets.has(target)) throw new Error(`Unknown deployment target: ${target}`);
	const errors = [];
	let result;
	if (target === 'infrastructure') result = infrastructure(environment, errors);
	else if (target === 'api') result = api(environment, errors);
	else if (target === 'landing')
		result = { ...publicValues(environment, errors), ...cloudflare(environment, errors) };
	else if (target === 'catalog')
		result = {
			...publicValues(environment, errors),
			catalogApiBaseUrl: secureUrl(environment, 'CATALOG_API_BASE_URL', errors, true),
			...cloudflare(environment, errors)
		};
	else if (target === 'contact')
		result = {
			landingSiteUrl: secureUrl(environment, 'LANDING_SITE_URL', errors, true),
			contactDomain: domain(environment, 'CONTACT_DOMAIN', errors),
			turnstileSiteKey: required(environment, 'TURNSTILE_SITE_KEY', errors),
			...cloudflare(environment, errors)
		};
	else
		result = {
			adminDomain: domain(environment, 'ADMIN_DOMAIN', errors),
			adminApiBaseUrl: secureUrl(environment, 'ADMIN_API_BASE_URL', errors, true),
			...cloudflare(environment, errors)
		};
	if (errors.length > 0) throw new Error(`Invalid production environment:\n${errors.join('\n')}`);
	return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	validateProductionEnvironment(process.argv[2] ?? '', process.env);
	process.stdout.write(`Production environment for ${process.argv[2]} is valid.\n`);
}
