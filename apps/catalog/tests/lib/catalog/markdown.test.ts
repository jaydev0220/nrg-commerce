import { expect, test } from 'vitest';

import { renderMarkdown } from '$lib/catalog/markdown.js';

test('renderMarkdown supports headings, lists, blockquotes, and code fences', () => {
	const html = renderMarkdown(`## Title

- item

> note

\`\`\`
const value = 1;
\`\`\``);

	expect(html).toMatch(/<h4>Title<\/h4>/);
	expect(html).toMatch(/<ul><li>item<\/li><\/ul>/);
	expect(html).toMatch(/<blockquote>note<\/blockquote>/);
	expect(html).toMatch(/<pre><code>const value = 1;<\/code><\/pre>/);
});

test('renderMarkdown sanitizes unsafe links and escapes raw html', () => {
	const html = renderMarkdown('[bad](javascript:alert(1)) <script>alert(1)</script>');

	expect(html).not.toMatch(/javascript:/);
	expect(html).toMatch(/href="#"/);
	expect(html).toMatch(/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
