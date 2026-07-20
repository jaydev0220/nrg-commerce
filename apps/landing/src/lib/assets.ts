import { PUBLIC_CDN_BASE_URL } from '$env/static/public';
import { createAssetUrlResolver, SHARED_ASSETS } from '@packages/assets';

export { SHARED_ASSETS };

export const LANDING_ASSETS = {
	brandingOpenGraph: '/og/branding.webp',
	aboutOpenGraph: '/og/landing/about.webp',
	contactOpenGraph: '/og/landing/contact.webp',
	companyStoryPhoto: '/landing/company-story-photo.webp',
	productBeakers: '/landing/products-beakers.webp',
	productCondensers: '/landing/products-condensers.webp',
	productTubes: '/landing/products-tubes.webp',
	productFunnels: '/landing/products-funnels.webp',
	productHydrometers: '/landing/products-hydrometers.webp'
} as const;

export const assetUrl = createAssetUrlResolver(PUBLIC_CDN_BASE_URL);
