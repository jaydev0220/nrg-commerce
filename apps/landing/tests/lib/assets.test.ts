import { expect, test, vi } from 'vitest';

vi.mock('$env/static/public', () => ({
	PUBLIC_CDN_BASE_URL: ' https://cdn.example.com'
}));

import { assetUrl, LANDING_ASSETS, SHARED_ASSETS } from '$lib/assets.js';

test('binds the CDN base and exposes shared and landing assets', () => {
	expect(assetUrl(SHARED_ASSETS.logoLight)).toBe('https://cdn.example.com/logo-light.svg');
	expect(assetUrl(LANDING_ASSETS.brandingOpenGraph)).toBe(
		'https://cdn.example.com/og/landing/branding.webp'
	);
});
