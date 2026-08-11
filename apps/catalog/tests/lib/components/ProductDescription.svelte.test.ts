import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';

import ProductDescription from '$lib/components/ProductDescription.svelte';

test('renders descriptions as escaped plain text while preserving authored line breaks', async () => {
	const source = '**bold**\n<script>alert("unsafe")</script>\n[link](javascript:alert(1))';
	const screen = await render(ProductDescription, { source });
	const description = screen.container.querySelector('p');

	expect(description?.textContent).toBe(source);
	expect(description?.classList.contains('whitespace-pre-line')).toBe(true);
	expect(screen.container.querySelector('strong, script, a')).toBeNull();
});
