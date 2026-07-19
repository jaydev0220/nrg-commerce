import { expect, test, vi } from 'vitest';

vi.mock('$env/static/public', () => ({
	PUBLIC_CDN_BASE_URL: ' https://cdn.example.com/assets/ '
}));

import { CDN_ASSETS, CDN_BASE_URL, cdnUrl } from '$lib/utils/cdn.js';

test('normalizes the CDN base and resolves root-relative asset paths', () => {
	expect(CDN_BASE_URL).toBe('https://cdn.example.com/assets/');
	expect(cdnUrl(CDN_ASSETS.logoLight)).toBe('https://cdn.example.com/logo-light.svg');
	expect(cdnUrl('landing/photo.webp')).toBe('https://cdn.example.com/assets/landing/photo.webp');
});
