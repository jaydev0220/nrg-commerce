import { expect, test } from 'vitest';

import { splitLineBreakTags } from '$lib/utils/line-breaks.js';

test('splits supported break tags while preserving adjacent text', () => {
	expect(splitLineBreakTags('First<br>Second<BR />Third<br/>')).toEqual([
		{ type: 'text', value: 'First' },
		{ type: 'br' },
		{ type: 'text', value: 'Second' },
		{ type: 'br' },
		{ type: 'text', value: 'Third' },
		{ type: 'br' }
	]);
});

test('returns one text segment without breaks and no segments for empty content', () => {
	expect(splitLineBreakTags('One line')).toEqual([{ type: 'text', value: 'One line' }]);
	expect(splitLineBreakTags('')).toEqual([]);
});
