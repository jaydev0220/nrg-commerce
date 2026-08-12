import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';

vi.mock('$env/static/public', () => ({
	PUBLIC_CDN_BASE_URL: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
	PUBLIC_FACEBOOK_URL: 'https://www.facebook.com/example',
	PUBLIC_LINE_URL: 'https://line.me/ti/p/example'
}));

import Footer from '../../src/lib/Footer.svelte';

test('uses the supplied localized home target for every footer logo', async () => {
	const screen = await render(Footer, {
		description: 'Laboratory glassware manufacturer',
		copyrightText: '© 2026 NRG Labware',
		homeHref: 'https://www.nrglabware.com/en/',
		legalLinks: [{ href: 'https://www.nrglabware.com/en/privacy/', label: 'Privacy' }],
		onToggleLanguage: vi.fn()
	});

	expect(
		Array.from(screen.container.querySelectorAll('a[aria-label="NRG"]')).map(
			(link) => (link as HTMLAnchorElement).href
		)
	).toEqual(['https://www.nrglabware.com/en/', 'https://www.nrglabware.com/en/']);
	expect(
		screen.container.querySelectorAll('a[href="https://www.nrglabware.com/en/privacy/"]')
	).toHaveLength(2);
	for (const socialLink of screen.container.querySelectorAll<HTMLAnchorElement>(
		'a[target="_blank"]'
	)) {
		expect(socialLink).toHaveClass('h-11');
	}
});
