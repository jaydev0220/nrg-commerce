import { flushSync } from 'svelte';
import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_CDN_BASE_URL: '' }));
vi.mock('$app/state', () => ({ page: { url: new URL('https://www.example.com/') } }));

import Navbar from '../../src/lib/Navbar.svelte';

test('marks the active route and closes the mobile menu after language selection', async () => {
	const onSelectLanguage = vi.fn();
	const onToggleTheme = vi.fn();
	const screen = await render(Navbar, {
		cta: { label: 'Contact sales', href: 'https://sales.example.com/contact' },
		navLinks: [
			{ id: 'home', href: '/', label: 'Home' },
			{ id: 'products', href: '/products', label: 'Products' }
		],
		onSelectLanguage,
		onToggleTheme
	});
	const menu = screen.getByRole('button', { name: 'Toggle mobile menu' });

	expect(screen.container.querySelectorAll('a[aria-current="page"]')).toHaveLength(1);
	await menu.click();
	await expect.element(menu).toHaveAttribute('aria-expanded', 'true');
	expect(screen.container.querySelectorAll('a[aria-current="page"]')).toHaveLength(2);
	expect(
		Array.from(screen.container.querySelectorAll<HTMLAnchorElement>('a')).filter(
			(link) => link.textContent?.trim() === 'Contact sales'
		)
	).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				target: '_blank',
				rel: expect.stringContaining('noopener')
			})
		])
	);

	const languageButtons = screen.container.querySelectorAll<HTMLButtonElement>(
		'button[aria-label="Switch language"]'
	);
	const mobileLanguageButton = languageButtons.item(languageButtons.length - 1);
	mobileLanguageButton.click();
	flushSync();
	const englishOption = Array.from(
		screen.container.querySelectorAll<HTMLButtonElement>('button[role="option"]')
	).find((option) => option.textContent?.trim() === 'English');
	if (!englishOption) throw new Error('English language option was not rendered.');
	englishOption.click();
	flushSync();

	expect(onSelectLanguage).toHaveBeenCalledWith('en');
	await expect.element(menu).toHaveAttribute('aria-expanded', 'false');
	const themeButton = screen.container.querySelector<HTMLButtonElement>(
		'button[aria-label="Toggle theme"]'
	);
	themeButton?.click();
	expect(onToggleTheme).toHaveBeenCalledOnce();
});
