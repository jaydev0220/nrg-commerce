import assert from 'node:assert/strict';
import test from 'node:test';

import { createTtlLruCache, stableSerialize } from '../../src/cache/ttl-cache.js';

test('ttl cache reuses values until the ttl expires', async () => {
	let now = 0;
	let loads = 0;
	const cache = createTtlLruCache<string, string>({
		ttlMs: 1_000,
		maxEntries: 5,
		now: () => now
	});

	const load = async () => `value-${++loads}`;
	assert.equal(await cache.getOrLoad('key', load), 'value-1');
	assert.equal(await cache.getOrLoad('key', load), 'value-1');
	assert.equal(loads, 1);

	now = 1_000;
	assert.equal(await cache.getOrLoad('key', load), 'value-2');
	assert.equal(loads, 2);
});

test('ttl cache evicts the least recently used entry', async () => {
	let loads = 0;
	const cache = createTtlLruCache<string, number>({ ttlMs: 1_000, maxEntries: 2 });
	const load = async (key: string) => ++loads + key.length;

	await cache.getOrLoad('a', () => load('a'));
	await cache.getOrLoad('b', () => load('b'));
	await cache.getOrLoad('a', () => load('a'));
	await cache.getOrLoad('c', () => load('c'));
	await cache.getOrLoad('b', () => load('b'));

	assert.equal(cache.size, 2);
	assert.equal(loads, 4);
});

test('ttl cache coalesces concurrent loads and does not cache failures', async () => {
	let loads = 0;
	let release: (() => void) | undefined;
	const cache = createTtlLruCache<string, string>({ ttlMs: 1_000, maxEntries: 2 });

	const first = cache.getOrLoad(
		'key',
		() =>
			new Promise<string>((resolve) => {
				loads += 1;
				release = () => resolve('loaded');
			})
	);
	const second = cache.getOrLoad('key', async () => {
		loads += 1;
		return 'unexpected';
	});
	await Promise.resolve();
	release?.();
	assert.deepEqual(await Promise.all([first, second]), ['loaded', 'loaded']);
	assert.equal(loads, 1);

	await assert.rejects(() =>
		cache.getOrLoad('failed', async () => {
			loads += 1;
			throw new Error('failed');
		})
	);
	await assert.rejects(() =>
		cache.getOrLoad('failed', async () => {
			loads += 1;
			throw new Error('failed again');
		})
	);
	assert.equal(loads, 3);
});

test('stable serialization ignores object key order', () => {
	assert.equal(
		stableSerialize({ query: { b: 2, a: 1 }, values: ['x', { d: true, c: false }] }),
		stableSerialize({ values: ['x', { c: false, d: true }], query: { a: 1, b: 2 } })
	);
});
