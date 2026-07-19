import { beforeEach, expect, test, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_COOKIE_DOMAIN: '' }));

import { theme } from '$lib/state/theme.svelte';

beforeEach(() => {
	theme.set('light');
});

test('applies and persists an explicitly selected theme', () => {
	theme.set('dark');

	expect(theme.current).toBe('dark');
	expect(document.documentElement.classList.contains('dark')).toBe(true);
	expect(document.documentElement.classList.contains('light')).toBe(false);
	expect(document.documentElement.style.colorScheme).toBe('dark');
	expect(document.cookie).toContain('theme=dark');
});

test('toggles between light and dark themes', () => {
	theme.toggle();
	expect(theme.current).toBe('dark');

	theme.toggle();
	expect(theme.current).toBe('light');
	expect(document.documentElement.classList.contains('light')).toBe(true);
});
