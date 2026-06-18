export type InlineBreakSegment = {
	type: 'text' | 'br';
	value?: string;
};

const BR_TAG_PATTERN = /<br\s*\/?>/gi;

export function splitLineBreakTags(content: string): InlineBreakSegment[] {
	const segments: InlineBreakSegment[] = [];
	let lastIndex = 0;
	BR_TAG_PATTERN.lastIndex = 0;

	for (const match of content.matchAll(BR_TAG_PATTERN)) {
		const index = match.index ?? 0;

		if (index > lastIndex) {
			segments.push({ type: 'text', value: content.slice(lastIndex, index) });
		}

		segments.push({ type: 'br' });
		lastIndex = index + match[0].length;
	}

	if (lastIndex < content.length) {
		segments.push({ type: 'text', value: content.slice(lastIndex) });
	}

	return segments;
}
