import { expect, test } from 'vitest';

import { createScrollRestoration } from '../../src/lib/scroll-restoration';

function createMemoryStorage() {
	const values = new Map<string, string>();

	return {
		getItem(key: string) {
			return values.get(key) ?? null;
		},
		setItem(key: string, value: string) {
			values.set(key, value);
		},
		removeItem(key: string) {
			values.delete(key);
		},
		read(key: string) {
			return values.get(key);
		}
	};
}

function routeKey(url: URL): string {
	return `${url.pathname}${url.search}${url.hash}`;
}

test('stores exact positions, shares locale-neutral keys, and clamps to document bounds', () => {
	const storage = createMemoryStorage();
	const restored: Array<[number, number]> = [];
	const restoration = createScrollRestoration({
		storageKey: 'scroll',
		storage,
		getRouteKey: routeKey,
		getScrollBounds: () => ({ maxX: 100, maxY: 600 }),
		scrollTo: (x, y) => restored.push([x, y])
	});

	restoration.capture(new URL('https://example.test/page'), { x: 12.5, y: 900 });

	expect(restoration.restore(new URL('https://example.test/en/page'))).toBe(false);
	const localized = createScrollRestoration({
		storageKey: 'scroll',
		storage,
		getRouteKey: (url) => url.pathname.replace(/^\/en/u, '') + url.search + url.hash,
		getScrollBounds: () => ({ maxX: 100, maxY: 600 }),
		scrollTo: (x, y) => restored.push([x, y])
	});

	expect(localized.restore(new URL('https://example.test/en/page'))).toBe(true);
	expect(restored).toEqual([[12.5, 600]]);
});

test('keeps the most recently used routes within the bounded session store', () => {
	const storage = createMemoryStorage();
	const restoration = createScrollRestoration({
		storageKey: 'scroll',
		storage,
		maxEntries: 2,
		getRouteKey: routeKey,
		getScrollPosition: () => ({ x: 0, y: 10 })
	});

	for (const pathname of ['/a', '/b', '/c']) {
		restoration.capture(new URL(`https://example.test${pathname}`));
	}

	expect(restoration.restore(new URL('https://example.test/a'))).toBe(false);
	expect(restoration.restore(new URL('https://example.test/b'))).toBe(true);
	restoration.capture(new URL('https://example.test/d'));
	expect(restoration.restore(new URL('https://example.test/c'))).toBe(false);
	expect(restoration.restore(new URL('https://example.test/b'))).toBe(true);
});

test('ignores malformed storage and tolerates storage failures', () => {
	const storage = createMemoryStorage();
	storage.setItem('scroll', '{malformed');
	const restored: Array<[number, number]> = [];
	const restoration = createScrollRestoration({
		storageKey: 'scroll',
		storage,
		getRouteKey: routeKey,
		scrollTo: (x, y) => restored.push([x, y])
	});

	expect(restoration.restore(new URL('https://example.test/page'))).toBe(false);
	expect(restored).toEqual([]);

	const failingStorage = {
		getItem: () => {
			throw new Error('blocked');
		},
		setItem: () => {
			throw new Error('blocked');
		},
		removeItem: () => {
			throw new Error('blocked');
		}
	};
	const safeRestoration = createScrollRestoration({
		storageKey: 'scroll',
		storage: failingStorage,
		getRouteKey: routeKey
	});

	expect(() => safeRestoration.capture(new URL('https://example.test/page'))).not.toThrow();
	expect(() => safeRestoration.clear()).not.toThrow();
});

test('rejects invalid entries and isolates route-key failures', () => {
	const storage = createMemoryStorage();
	storage.setItem(
		'scroll',
		JSON.stringify({
			version: 1,
			entries: [
				null,
				{ key: 'negative', x: -1, y: 10 },
				{ key: 'wrong-type', x: '12', y: 10 },
				{ key: '/valid', x: 12, y: 34 }
			]
		})
	);
	const restored: Array<[number, number]> = [];
	const restoration = createScrollRestoration({
		storageKey: 'scroll',
		storage,
		getRouteKey: routeKey,
		getScrollBounds: () => ({ maxX: 100, maxY: 100 }),
		scrollTo: (x, y) => restored.push([x, y])
	});

	expect(restoration.restore(new URL('https://example.test/valid'))).toBe(true);
	expect(restored).toEqual([[12, 34]]);

	const emptyKeyRestoration = createScrollRestoration({
		storageKey: 'empty-key',
		storage,
		getRouteKey: () => ''
	});
	expect(emptyKeyRestoration.restore(new URL('https://example.test/page'))).toBe(false);
	expect(() => emptyKeyRestoration.capture(new URL('https://example.test/page'))).not.toThrow();

	const throwingKeyRestoration = createScrollRestoration({
		storageKey: 'throwing-key',
		storage,
		getRouteKey: () => {
			throw new Error('route key unavailable');
		}
	});
	expect(throwingKeyRestoration.restore(new URL('https://example.test/page'))).toBe(false);
	expect(() => throwingKeyRestoration.capture(new URL('https://example.test/page'))).not.toThrow();
});

test('uses browser defaults when callers omit position, bounds, and storage adapters', () => {
	const storageKey = `scroll-default-${Date.now()}`;
	const restored: Array<[number, number]> = [];
	const restoration = createScrollRestoration({
		storageKey,
		getRouteKey: routeKey,
		scrollTo: (x, y) => restored.push([x, y])
	});

	restoration.capture(new URL('https://example.test/defaults'));
	expect(restoration.restore(new URL('https://example.test/defaults'))).toBe(true);
	expect(restored).toHaveLength(1);
	restoration.clear();

	const sessionStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
	Object.defineProperty(window, 'sessionStorage', {
		configurable: true,
		get() {
			throw new Error('session storage unavailable');
		}
	});
	try {
		const unavailable = createScrollRestoration({ storageKey, getRouteKey: routeKey });
		expect(unavailable.restore(new URL('https://example.test/defaults'))).toBe(false);
		expect(() => unavailable.clear()).not.toThrow();
	} finally {
		if (sessionStorageDescriptor) {
			Object.defineProperty(window, 'sessionStorage', sessionStorageDescriptor);
		}
	}
});
