import { PUBLIC_CDN_BASE_URL } from '$env/static/public';
import { createAssetUrlResolver, SHARED_ASSETS } from '@packages/assets';

export { SHARED_ASSETS };

export const CATALOG_ASSETS = {
	galleryOpenGraph: '/og/catalog/gallery.webp',
	inquiryOpenGraph: '/og/catalog/inquiry.webp'
} as const;

export const assetUrl = createAssetUrlResolver(PUBLIC_CDN_BASE_URL);
