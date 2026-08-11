import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';

import ContactInfo from '$lib/components/contact/ContactInfo.svelte';
import { contactItems, socialLinks } from '$lib/data';

test('renders each contact method, social link, and map exactly once', async () => {
	const screen = await render(ContactInfo);

	for (const item of contactItems) {
		expect(screen.container).toHaveTextContent(item.label());
		expect(screen.container).toHaveTextContent(item.value());
	}

	const links = screen.container.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]');
	expect(links).toHaveLength(socialLinks.length);
	for (const social of socialLinks) {
		expect(screen.container.querySelectorAll(`a[href="${social.href}"]`)).toHaveLength(1);
	}

	expect(screen.container.querySelectorAll('iframe[title="Map"]')).toHaveLength(1);
});
