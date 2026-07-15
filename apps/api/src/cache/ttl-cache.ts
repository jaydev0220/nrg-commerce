export type CacheEvent = 'hit' | 'miss' | 'coalesced' | 'expired' | 'evicted';

type CacheEntry<Value> = {
	value: Value;
	expiresAt: number;
};

type TtlCacheOptions = {
	ttlMs: number;
	maxEntries: number;
	now?: () => number;
	onEvent?: (event: CacheEvent, size: number) => void;
};

function stableSerialize(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? String(value);
	if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;

	return `{${Object.entries(value)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableSerialize(nestedValue)}`)
		.join(',')}}`;
}

export function createTtlLruCache<Key, Value>(options: TtlCacheOptions) {
	const entries = new Map<Key, CacheEntry<Value>>();
	const pending = new Map<Key, Promise<Value>>();
	const now = options.now ?? Date.now;

	function emit(event: CacheEvent) {
		options.onEvent?.(event, entries.size);
	}

	async function getOrLoad(key: Key, load: () => Promise<Value>): Promise<Value> {
		const currentTime = now();
		const entry = entries.get(key);
		if (entry) {
			if (entry.expiresAt > currentTime) {
				entries.delete(key);
				entries.set(key, entry);
				emit('hit');
				return entry.value;
			}
			entries.delete(key);
			emit('expired');
		}

		const pendingRequest = pending.get(key);
		if (pendingRequest) {
			emit('coalesced');
			return pendingRequest;
		}

		emit('miss');
		const request = Promise.resolve().then(load);
		pending.set(key, request);
		try {
			const value = await request;
			pending.delete(key);
			entries.delete(key);
			entries.set(key, { value, expiresAt: now() + options.ttlMs });
			while (entries.size > options.maxEntries) {
				const oldestKey = entries.keys().next().value as Key | undefined;
				if (oldestKey === undefined) break;
				entries.delete(oldestKey);
				emit('evicted');
			}
			return value;
		} catch (error) {
			pending.delete(key);
			throw error;
		}
	}

	return {
		getOrLoad,
		clear: () => entries.clear(),
		get size() {
			return entries.size;
		}
	};
}

export { stableSerialize };
