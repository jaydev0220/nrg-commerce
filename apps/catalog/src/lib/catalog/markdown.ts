function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

function sanitizeHref(rawUrl: string): string {
	try {
		const parsedUrl = new URL(rawUrl, 'https://example.com');
		return ['https:', 'http:', 'mailto:'].includes(parsedUrl.protocol) ? rawUrl : '#';
	} catch {
		return '#';
	}
}

function renderInlineMarkdown(value: string): string {
	const tokens: string[] = [];
	const token = (html: string) => {
		const marker = `@@MDTOKEN${tokens.length}@@`;
		tokens.push(html);
		return marker;
	};

	const source = String(value)
		.replace(/`([^`]+)`/g, (_match, code: string) =>
			token(
				`<code class="rounded-sm bg-bg-sunken px-1.5 py-0.5 font-mono text-[.9em] text-text-heading">${escapeHtml(code)}</code>`
			)
		)
		.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, rawUrl: string) => {
			const href = sanitizeHref(rawUrl);
			const external = /^https?:/i.test(href);
			return token(
				`<a class="font-medium text-text-accent underline decoration-border-accent underline-offset-4 transition-colors duration-base ease-ui hover:text-brand-hover" href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noreferrer noopener"' : ''}>${escapeHtml(label)}</a>`
			);
		});

	const rendered = escapeHtml(source)
		.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-text-heading">$1</strong>')
		.replace(/__([^_]+)__/g, '<strong class="font-semibold text-text-heading">$1</strong>')
		.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
		.replace(/(^|[^_])_([^_]+)_/g, '$1<em>$2</em>');

	return rendered.replace(
		/@@MDTOKEN(\d+)@@/g,
		(_match, index: string) => tokens[Number(index)] ?? ''
	);
}

export function renderMarkdown(value: string | null | undefined): string {
	if (!value) {
		return '';
	}

	try {
		const lines = value.replace(/\r\n?/g, '\n').split('\n');
		const output: string[] = [];
		let paragraph: string[] = [];
		let listType: 'ordered' | 'unordered' | null = null;
		let listItems: string[] = [];
		let codeBlock: string[] | null = null;

		const flushParagraph = () => {
			if (paragraph.length > 0) {
				output.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
				paragraph = [];
			}
		};

		const flushList = () => {
			if (listType === null) {
				return;
			}

			const tagName = listType === 'ordered' ? 'ol' : 'ul';
			output.push(
				`<${tagName}>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</${tagName}>`
			);
			listType = null;
			listItems = [];
		};

		for (const line of lines) {
			if (codeBlock) {
				if (/^```/.test(line)) {
					output.push(`<pre><code>${escapeHtml(codeBlock.join('\n'))}</code></pre>`);
					codeBlock = null;
					continue;
				}

				codeBlock.push(line);
				continue;
			}

			if (/^```/.test(line)) {
				flushParagraph();
				flushList();
				codeBlock = [];
				continue;
			}

			if (!line.trim()) {
				flushParagraph();
				flushList();
				continue;
			}

			const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
			if (headingMatch) {
				flushParagraph();
				flushList();
				const hashes = headingMatch[1];
				const content = headingMatch[2];
				if (!hashes || !content) {
					continue;
				}
				const level = Math.min(hashes.length + 2, 4);
				output.push(`<h${level}>${renderInlineMarkdown(content)}</h${level}>`);
				continue;
			}

			if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
				flushParagraph();
				flushList();
				output.push('<hr>');
				continue;
			}

			const unorderedMatch = line.match(/^\s*[-*+]\s+(.+)$/);
			if (unorderedMatch) {
				flushParagraph();
				if (listType && listType !== 'unordered') {
					flushList();
				}
				const content = unorderedMatch[1];
				if (!content) {
					continue;
				}
				listType = 'unordered';
				listItems.push(content);
				continue;
			}

			const orderedMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);
			if (orderedMatch) {
				flushParagraph();
				if (listType && listType !== 'ordered') {
					flushList();
				}
				const content = orderedMatch[1];
				if (!content) {
					continue;
				}
				listType = 'ordered';
				listItems.push(content);
				continue;
			}

			const quoteMatch = line.match(/^>\s?(.+)$/);
			if (quoteMatch) {
				flushParagraph();
				flushList();
				const content = quoteMatch[1];
				if (!content) {
					continue;
				}
				output.push(`<blockquote>${renderInlineMarkdown(content)}</blockquote>`);
				continue;
			}

			paragraph.push(line.trim());
		}

		if (codeBlock) {
			output.push(`<pre><code>${escapeHtml(codeBlock.join('\n'))}</code></pre>`);
		}

		flushParagraph();
		flushList();

		return output.join('');
	} catch {
		return `<p>${escapeHtml(value)}</p>`;
	}
}
