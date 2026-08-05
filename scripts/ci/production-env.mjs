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

function secureUrl(environment, name, errors, options = {}) {
	const value = required(environment, name, errors);
	if (!value) return '';

	try {
		const url = new URL(value);
		if (
			url.protocol !== 'https:' ||
			url.username ||
			url.password ||
			isLoopbackHostname(url.hostname) ||
			url.search ||
			url.hash ||
			(options.rootOnly && (url.pathname !== '/' || value !== url.origin))
		) {
			throw new Error('invalid URL');
		}
		return options.rootOnly ? url.origin : value.replace(/\/+$/, '');
	} catch {
		errors.push(`${name} must be a secure HTTPS URL${options.rootOnly ? ' without a path' : ''}.`);
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
			isLoopbackHostname(url.hostname) ||
			url.port ||
			url.pathname !== '/' ||
			url.search ||
			url.hash
		) {
			throw new Error('invalid domain');
		}
		return value;
	} catch {
		errors.push(`${name} must contain a hostname without a scheme, port, or path.`);
		return '';
	}
}

function cloudflare(environment, errors) {
	const cloudflareAccountId = required(environment, 'CLOUDFLARE_ACCOUNT_ID', errors);
	required(environment, 'CLOUDFLARE_API_TOKEN', errors);

	if (cloudflareAccountId && !/^[0-9a-f]{32}$/u.test(cloudflareAccountId)) {
		errors.push('CLOUDFLARE_ACCOUNT_ID must be a 32-character lowercase hexadecimal ID.');
	}

	return { cloudflareAccountId };
}

function secureDatabaseUrl(environment, name, errors) {
	const value = required(environment, name, errors);
	if (!value) return '';

	try {
		const url = new URL(value);
		if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
			throw new Error('invalid protocol');
		}
		if (isLoopbackHostname(url.hostname) || url.hash) {
			throw new Error('invalid database host');
		}
		if (url.searchParams.get('sslmode') !== 'verify-full') {
			throw new Error('missing sslmode');
		}
	} catch {
		errors.push(`${name} must use a PostgreSQL URL with sslmode=verify-full.`);
	}

	return value;
}

function secureOriginList(environment, name, errors) {
	const value = required(environment, name, errors);
	if (!value) return [];

	const origins = value
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean)
		.map((origin) => {
			try {
				const url = new URL(origin);
				if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) {
					throw new Error('invalid origin');
				}
				return url.origin;
			} catch {
				errors.push(`${name} must contain only secure HTTPS origins.`);
				return '';
			}
		});

	return origins.filter(Boolean);
}

function api(environment, errors) {
	const deploymentEnvironment = required(environment, 'DEPLOYMENT_ENVIRONMENT', errors);
	if (deploymentEnvironment && !['staging', 'production'].includes(deploymentEnvironment)) {
		errors.push('DEPLOYMENT_ENVIRONMENT must be staging or production.');
	}

	for (const name of [
		'AZURE_CLIENT_ID',
		'AZURE_TENANT_ID',
		'AZURE_SUBSCRIPTION_ID',
		'AZURE_RESOURCE_GROUP',
		'AZURE_CONTAINER_APP_ENVIRONMENT',
		'AZURE_CONTAINER_APP_NAME',
		'AZURE_CONTAINER_APP_CERTIFICATE_NAME',
		'API_DNS_TF_WORKSPACE',
		'HCP_TERRAFORM_TOKEN',
		'CLOUDFLARE_ZONE_ID',
		'DIRECT_URL',
		'DATABASE_URL',
		'ACCESS_TOKEN_SECRET',
		'REFRESH_TOKEN_SECRET',
		'PENDING_TOKEN_SECRET',
		'DATA_ENCRYPTION_SECRET',
		'R2_ACCESS_KEY_ID',
		'R2_SECRET_ACCESS_KEY'
	]) {
		required(environment, name, errors);
	}

	const cloudflareZoneId = environment['CLOUDFLARE_ZONE_ID']?.trim() ?? '';
	if (cloudflareZoneId && !/^[0-9a-f]{32}$/u.test(cloudflareZoneId)) {
		errors.push('CLOUDFLARE_ZONE_ID must be a 32-character lowercase hexadecimal ID.');
	}

	secureDatabaseUrl(environment, 'DATABASE_URL', errors);
	secureDatabaseUrl(environment, 'DIRECT_URL', errors);
	secureOriginList(environment, 'CORS_ORIGINS', errors);
	secureUrl(environment, 'WEBAUTHN_ORIGIN', errors);
	secureUrl(environment, 'R2_PUBLIC_BASE_URL', errors);
	secureUrl(environment, 'OTEL_EXPORTER_OTLP_ENDPOINT', errors);
	domain(environment, 'API_DOMAIN', errors);

	const trustProxyHops = required(environment, 'TRUST_PROXY_HOPS', errors);
	if (trustProxyHops && !/^\d+$/u.test(trustProxyHops)) {
		errors.push('TRUST_PROXY_HOPS must be a non-negative integer.');
	}

	return {
		deploymentEnvironment,
		apiDomain: environment['API_DOMAIN']?.trim().toLowerCase() ?? '',
		azureResourceGroup: environment['AZURE_RESOURCE_GROUP']?.trim() ?? '',
		azureContainerAppEnvironment: environment['AZURE_CONTAINER_APP_ENVIRONMENT']?.trim() ?? '',
		azureContainerAppName: environment['AZURE_CONTAINER_APP_NAME']?.trim() ?? '',
		apiDnsTerraformWorkspace: environment['API_DNS_TF_WORKSPACE']?.trim() ?? ''
	};
}

function infrastructure(environment, errors) {
	const deploymentEnvironment = required(environment, 'DEPLOYMENT_ENVIRONMENT', errors);
	if (deploymentEnvironment && !['staging', 'production'].includes(deploymentEnvironment)) {
		errors.push('DEPLOYMENT_ENVIRONMENT must be staging or production.');
	}
	required(environment, 'HCP_TERRAFORM_TOKEN', errors);

	return {
		deploymentEnvironment,
		adminDomain: domain(environment, 'ADMIN_DOMAIN', errors),
		hcpTerraformOrganization: required(environment, 'TF_CLOUD_ORGANIZATION', errors),
		hcpTerraformProject: required(environment, 'TF_CLOUD_PROJECT', errors),
		hcpTerraformWorkspace: required(environment, 'TF_WORKSPACE', errors),
		...cloudflare(environment, errors)
	};
}

function publicSiteValues(environment, errors) {
	const catalogDomain = domain(environment, 'CATALOG_DOMAIN', errors);
	const contactDomain = domain(environment, 'CONTACT_DOMAIN', errors);

	return {
		landingSiteUrl: secureUrl(environment, 'LANDING_SITE_URL', errors, { rootOnly: true }),
		catalogDomain,
		catalogUrl: catalogDomain ? `https://${catalogDomain}` : '',
		contactUrl: contactDomain ? `https://${contactDomain}` : '',
		cdnBaseUrl: secureUrl(environment, 'CDN_BASE_URL', errors),
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

	if (target === 'infrastructure') {
		result = infrastructure(environment, errors);
	} else if (target === 'api') {
		result = api(environment, errors);
	} else if (target === 'landing') {
		const values = publicSiteValues(environment, errors);
		const landingDomain = domain(environment, 'LANDING_DOMAIN', errors);
		if (
			values.landingSiteUrl &&
			landingDomain &&
			new URL(values.landingSiteUrl).hostname !== landingDomain
		) {
			errors.push('LANDING_DOMAIN must match the hostname in LANDING_SITE_URL.');
		}
		result = {
			landingSiteUrl: values.landingSiteUrl,
			landingDomain,
			catalogUrl: values.catalogUrl,
			contactUrl: values.contactUrl,
			cdnBaseUrl: values.cdnBaseUrl,
			cookieDomain: values.cookieDomain,
			facebookUrl: values.facebookUrl,
			lineUrl: values.lineUrl,
			turnstileSiteKey: values.turnstileSiteKey,
			...cloudflare(environment, errors)
		};
	} else if (target === 'catalog') {
		const values = publicSiteValues(environment, errors);
		result = {
			landingSiteUrl: values.landingSiteUrl,
			catalogDomain: values.catalogDomain,
			catalogApiBaseUrl: secureUrl(environment, 'CATALOG_API_BASE_URL', errors),
			contactUrl: values.contactUrl,
			cdnBaseUrl: values.cdnBaseUrl,
			cookieDomain: values.cookieDomain,
			facebookUrl: values.facebookUrl,
			lineUrl: values.lineUrl,
			turnstileSiteKey: values.turnstileSiteKey,
			...cloudflare(environment, errors)
		};
	} else if (target === 'contact') {
		result = {
			landingSiteUrl: secureUrl(environment, 'LANDING_SITE_URL', errors, { rootOnly: true }),
			contactDomain: domain(environment, 'CONTACT_DOMAIN', errors),
			...cloudflare(environment, errors)
		};
	} else {
		result = {
			adminDomain: domain(environment, 'ADMIN_DOMAIN', errors),
			adminApiBaseUrl: secureUrl(environment, 'ADMIN_API_BASE_URL', errors, {
				rootOnly: true
			}),
			...cloudflare(environment, errors)
		};
	}

	if (errors.length > 0) throw new Error(`Invalid deployment environment:\n${errors.join('\n')}`);
	return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	validateProductionEnvironment(process.argv[2] ?? '', process.env);
	process.stdout.write(`Deployment environment for ${process.argv[2]} is valid.\n`);
}
