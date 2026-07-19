import { pathToFileURL } from 'node:url';

const targets = new Set(['landing', 'catalog', 'contact']);

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
		if (url.hostname !== value || url.port || url.pathname !== '/' || url.search || url.hash) {
			throw new Error('invalid domain');
		}
		return value;
	} catch {
		errors.push(`${name} must contain a hostname without a scheme, port, or path.`);
		return '';
	}
}

function cloudflare(environment, errors) {
	return {
		cloudflareAccountId: required(environment, 'CLOUDFLARE_ACCOUNT_ID', errors),
		cloudflareApiToken: required(environment, 'CLOUDFLARE_API_TOKEN', errors)
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
	if (!targets.has(target)) throw new Error(`Unknown production target: ${target}`);
	const errors = [];
	let result;

	if (target === 'landing') {
		const values = publicSiteValues(environment, errors);
		result = {
			landingSiteUrl: values.landingSiteUrl,
			catalogUrl: values.catalogUrl,
			contactUrl: values.contactUrl,
			cdnBaseUrl: values.cdnBaseUrl,
			cookieDomain: values.cookieDomain,
			facebookUrl: values.facebookUrl,
			lineUrl: values.lineUrl,
			turnstileSiteKey: values.turnstileSiteKey
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
	} else {
		result = {
			landingSiteUrl: secureUrl(environment, 'LANDING_SITE_URL', errors, { rootOnly: true }),
			contactDomain: domain(environment, 'CONTACT_DOMAIN', errors),
			...cloudflare(environment, errors)
		};
	}

	if (errors.length > 0) throw new Error(`Invalid production environment:\n${errors.join('\n')}`);
	return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	validateProductionEnvironment(process.argv[2] ?? '', process.env);
	process.stdout.write(`Production environment for ${process.argv[2]} is valid.\n`);
}
