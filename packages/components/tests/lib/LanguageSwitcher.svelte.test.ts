import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';

import LanguageSwitcher from '../../src/lib/LanguageSwitcher.svelte';

const options = [
	{ label: 'Traditional Chinese', shortLabel: 'ZH', value: 'zh-tw' },
	{ label: 'English', shortLabel: 'EN', value: 'en' }
];

test('selects a language and closes the listbox', async () => {
	const onSelect = vi.fn();
	const screen = await render(LanguageSwitcher, {
		ariaLabel: 'Switch language',
		currentLocale: 'zh-tw',
		onSelect,
		options
	});
	const trigger = screen.getByRole('button', { name: 'Switch language' });

	await trigger.click();
	await expect.element(screen.getByRole('listbox')).toBeVisible();
	await expect
		.element(screen.getByRole('option', { name: 'Traditional Chinese' }))
		.toHaveAttribute('aria-selected', 'true');
	await screen.getByRole('option', { name: 'English' }).click();

	expect(onSelect).toHaveBeenCalledWith('en');
	await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');
	expect(screen.container.querySelector('[role="listbox"]')).toBeNull();
});

test('closes an open language listbox when the document is clicked elsewhere', async () => {
	const screen = await render(LanguageSwitcher, {
		ariaLabel: 'Switch language',
		currentLocale: 'unknown',
		onSelect: vi.fn(),
		options
	});
	const trigger = screen.getByRole('button', { name: 'Switch language' });

	await trigger.click();
	await expect.element(screen.getByRole('listbox')).toBeVisible();
	document.body.click();

	await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');
	expect(screen.container.querySelector('[role="listbox"]')).toBeNull();
});
