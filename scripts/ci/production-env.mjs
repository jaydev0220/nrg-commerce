import { pathToFileURL } from 'node:url';

const targets = new Set(['landing', 'catalog', 'contact', 'admin', 'infrastructure']);

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
