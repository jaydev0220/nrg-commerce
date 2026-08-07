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

test('renderMarkdown keeps ordered and unordered lists separate', () => {
	expect(renderMarkdown('1. first\n2) second\n- third\n+ fourth')).toBe(
		'<ol><li>first</li><li>second</li></ol><ul><li>third</li><li>fourth</li></ul>'
	);
});

test('renderMarkdown renders paragraphs and horizontal rules', () => {
	expect(renderMarkdown('first line\nsecond line\n\n***\n\nlast line')).toBe(
		'<p>first line second line</p><hr><p>last line</p>'
	);
});

test('renderMarkdown escapes unterminated code fences and inline formatting', () => {
	const html = renderMarkdown(
		'**bold** __strong__ *emphasis* _alternate_\n\n```\n<script>alert(1)</script>'
	);

	expect(html).toMatch(/<p><strong class="font-semibold text-text-heading">bold<\/strong>/);
	expect(html).toMatch(/<em>emphasis<\/em>/);
	expect(html).toMatch(/<pre><code>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/code><\/pre>/);
});

test('renderMarkdown preserves allowed links and sanitizes malicious protocols', () => {
	const html = renderMarkdown(
		'[secure](https://example.com/docs) [email](mailto:team@example.com) [relative](/docs) [ftp](ftp://example.com)'
	);

	expect(html).toMatch(
		/href="https:\/\/example\.com\/docs" target="_blank" rel="noreferrer noopener"/
	);
	expect(html).toMatch(/href="mailto:team@example\.com"/);
	expect(html).toMatch(/href="\/docs"/);
	expect(html).not.toMatch(/ftp:\/\//);
	expect(html).toMatch(/href="#"/);
});
