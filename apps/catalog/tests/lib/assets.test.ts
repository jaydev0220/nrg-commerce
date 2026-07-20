import { expect, test, vi } from 'vitest';

vi.mock('$env/static/public', () => ({
	PUBLIC_CDN_BASE_URL: ' https://cdn.example.com/assets '
}));

import { assetUrl, CATALOG_ASSETS, SHARED_ASSETS } from '$lib/assets.js';

test('binds the CDN base and exposes shared and catalog assets', () => {
	expect(assetUrl(SHARED_ASSETS.favicon)).toBe('https://cdn.example.com/favicon.ico');
	expect(assetUrl(CATALOG_ASSETS.inquiryOpenGraph)).toBe(
		'https://cdn.example.com/og/catalog/inquiry.webp'
	);
});
