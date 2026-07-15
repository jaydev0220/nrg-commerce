import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';

import { createApiLogger } from '../../src/logging/logger.js';

function createOutput() {
	const lines: string[] = [];
	const destination = new Writable({
		write(chunk, _encoding, callback) {
			lines.push(String(chunk).trim());
			callback();
		}
	});

	return { destination, lines };
}

test('writes structured JSON at or above the configured level', () => {
	const { destination, lines } = createOutput();
	const logger = createApiLogger({ level: 'info', destination });

	logger.debug({ requestId: 'request-1' }, 'hidden debug event');
	logger.info({ requestId: 'request-1' }, 'visible info event');
	logger.error({ requestId: 'request-1' }, 'visible error event');

	assert.equal(lines.length, 2);
	assert.deepEqual(
		lines.map((line) => {
			const parsed = JSON.parse(line) as Record<string, unknown>;
			return { level: parsed['level'], message: parsed['msg'], requestId: parsed['requestId'] };
		}),
		[
			{ level: 30, message: 'visible info event', requestId: 'request-1' },
			{ level: 50, message: 'visible error event', requestId: 'request-1' }
		]
	);
});
