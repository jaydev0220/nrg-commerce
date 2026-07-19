import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';

import ThemeSwitcher from '../../src/lib/ThemeSwitcher.svelte';

test('exposes the current theme title and delegates toggling', async () => {
	const onToggle = vi.fn();
	const screen = await render(ThemeSwitcher, {
		ariaLabel: 'Toggle theme',
		darkTitle: 'Dark theme',
		lightTitle: 'Light theme',
		onToggle,
		theme: 'light'
	});
	const button = screen.getByRole('button', { name: 'Toggle theme' });

	await expect.element(button).toHaveAttribute('title', 'Light theme');
	await button.click();

	expect(onToggle).toHaveBeenCalledOnce();
});
