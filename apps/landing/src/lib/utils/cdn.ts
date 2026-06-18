export const CDN_BASE_URL = 'https://cdn.nrglabware.com';

export const CDN_ASSETS = {
	// Branding
	logoDark: '/logo-dark.svg',
	logoLight: '/logo-light.svg',
	favicon: '/favicon.ico',

	// About page
	companyStoryPhoto: '/landing/company-story-photo.webp',

	// Product categories
	productBeakers: '/landing/products-beakers.webp',
	productCondensers: '/landing/products-condensers.webp',
	productTubes: '/landing/products-tubes.webp',
	productFunnels: '/landing/products-funnels.webp',
	productHydrometers: '/landing/products-hydrometers.webp'
} as const;

export function cdnUrl(path: string): string {
	return new URL(path, CDN_BASE_URL).toString();
}
