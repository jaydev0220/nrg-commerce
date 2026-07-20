export const SHARED_ASSETS = {
	logoDark: '/logo-dark.svg',
	logoLight: '/logo-light.svg',
	favicon: '/favicon.ico'
} as const;

export type AssetUrlResolver = (path: string) => string;

const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

function parseBaseUrl(input: string): URL {
	const value = input.trim();
	if (!value) {
		throw new TypeError('Asset base URL is required.');
	}

	let baseUrl: URL;
	try {
		baseUrl = new URL(value);
	} catch {
		throw new TypeError('Asset base URL must be a valid HTTPS URL.');
	}

	if (baseUrl.protocol !== 'https:') {
		throw new TypeError('Asset base URL must use HTTPS.');
	}

	if (!baseUrl.pathname.endsWith('/')) {
		baseUrl.pathname += '/';
	}

	return baseUrl;
}

function assertRelativeAssetPath(path: string): void {
	const value = path.trim();
	if (ABSOLUTE_URL_PATTERN.test(value) || value.startsWith('//')) {
		throw new TypeError('Asset path must be relative to the configured asset base URL.');
	}
}

export function createAssetUrlResolver(baseUrl: string): AssetUrlResolver {
	const normalizedBaseUrl = parseBaseUrl(baseUrl);

	return (path) => {
		assertRelativeAssetPath(path);
		return new URL(path, normalizedBaseUrl).toString();
	};
}
