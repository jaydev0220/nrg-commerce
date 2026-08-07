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

type ListType = 'ordered' | 'unordered';

type MarkdownBlock =
	| { kind: 'heading'; level: number; content: string }
	| { kind: 'horizontal-rule' }
	| { kind: 'list-item'; listType: ListType; content: string }
	| { kind: 'blockquote'; content: string };

type MarkdownState = {
	output: string[];
	paragraph: string[];
	listType: ListType | null;
	listItems: string[];
	codeBlock: string[] | null;
};

function createMarkdownState(): MarkdownState {
	return { output: [], paragraph: [], listType: null, listItems: [], codeBlock: null };
}

function flushParagraph(state: MarkdownState): void {
	if (state.paragraph.length === 0) return;

	state.output.push(`<p>${renderInlineMarkdown(state.paragraph.join(' '))}</p>`);
	state.paragraph = [];
}

function flushList(state: MarkdownState): void {
	if (state.listType === null) return;

	const tagName = state.listType === 'ordered' ? 'ol' : 'ul';
	state.output.push(
		`<${tagName}>${state.listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</${tagName}>`
	);
	state.listType = null;
	state.listItems = [];
}

function flushBlocks(state: MarkdownState): void {
	flushParagraph(state);
	flushList(state);
}

function flushCodeBlock(state: MarkdownState): void {
	if (state.codeBlock === null) return;

	state.output.push(`<pre><code>${escapeHtml(state.codeBlock.join('\n'))}</code></pre>`);
	state.codeBlock = null;
}

function classifyBlock(line: string): MarkdownBlock | null {
	const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
	if (headingMatch) {
		const hashes = headingMatch[1];
		const content = headingMatch[2];
		if (hashes && content) {
			return { kind: 'heading', level: Math.min(hashes.length + 2, 4), content };
		}
	}

	if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
		return { kind: 'horizontal-rule' };
	}

	const unorderedMatch = line.match(/^\s*[-*+]\s+(.+)$/);
	if (unorderedMatch?.[1]) {
		return { kind: 'list-item', listType: 'unordered', content: unorderedMatch[1] };
	}

	const orderedMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);
	if (orderedMatch?.[1]) {
		return { kind: 'list-item', listType: 'ordered', content: orderedMatch[1] };
	}

	const quoteMatch = line.match(/^>\s?(.+)$/);
	if (quoteMatch?.[1]) {
		return { kind: 'blockquote', content: quoteMatch[1] };
	}

	return null;
}

function appendListItem(
	state: MarkdownState,
	block: Extract<MarkdownBlock, { kind: 'list-item' }>
): void {
	flushParagraph(state);
	if (state.listType !== null && state.listType !== block.listType) flushList(state);

	state.listType = block.listType;
	state.listItems.push(block.content);
}

function renderBlock(block: Exclude<MarkdownBlock, { kind: 'list-item' }>): string {
	switch (block.kind) {
		case 'heading':
			return `<h${block.level}>${renderInlineMarkdown(block.content)}</h${block.level}>`;
		case 'horizontal-rule':
			return '<hr>';
		case 'blockquote':
			return `<blockquote>${renderInlineMarkdown(block.content)}</blockquote>`;
	}
}

function processMarkdownLine(line: string, state: MarkdownState): void {
	if (state.codeBlock !== null) {
		if (/^```/.test(line)) flushCodeBlock(state);
		else state.codeBlock.push(line);
		return;
	}

	if (/^```/.test(line)) {
		flushBlocks(state);
		state.codeBlock = [];
		return;
	}

	if (!line.trim()) {
		flushBlocks(state);
		return;
	}

	const block = classifyBlock(line);
	if (!block) {
		state.paragraph.push(line.trim());
		return;
	}
	if (block.kind === 'list-item') {
		appendListItem(state, block);
		return;
	}

	flushBlocks(state);
	state.output.push(renderBlock(block));
}

function finishMarkdown(state: MarkdownState): void {
	flushCodeBlock(state);
	flushBlocks(state);
}

export function renderMarkdown(value: string | null | undefined): string {
	if (!value) return '';

	try {
		const state = createMarkdownState();
		for (const line of value.replace(/\r\n?/g, '\n').split('\n')) {
			processMarkdownLine(line, state);
		}
		finishMarkdown(state);
		return state.output.join('');
	} catch {
		return `<p>${escapeHtml(value)}</p>`;
	}
}
