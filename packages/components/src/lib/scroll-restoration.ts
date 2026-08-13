export type ScrollPosition = {
	x: number;
	y: number;
};

type ScrollEntry = ScrollPosition & {
	key: string;
};

type PersistedScrollState = {
	version: 1;
	entries: ScrollEntry[];
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type ScrollRestorationOptions = {
	storageKey: string;
	getRouteKey: (url: URL) => string;
	storage?: StorageLike;
	maxEntries?: number;
	getScrollPosition?: () => ScrollPosition;
	scrollTo?: (x: number, y: number) => void;
	getScrollBounds?: () => { maxX: number; maxY: number };
};

const CURRENT_VERSION = 1 as const;
const DEFAULT_MAX_ENTRIES = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isScrollEntry(value: unknown): value is ScrollEntry {
	if (!isRecord(value)) return false;

	return (
		typeof value['key'] === 'string' &&
		typeof value['x'] === 'number' &&
		typeof value['y'] === 'number' &&
		Number.isFinite(value['x']) &&
		Number.isFinite(value['y']) &&
		value['x'] >= 0 &&
		value['y'] >= 0
	);
}

function emptyState(): PersistedScrollState {
	return { version: CURRENT_VERSION, entries: [] };
}

function resolveDefaultStorage(): StorageLike | undefined {
	if (typeof window === 'undefined') return undefined;

	try {
		return window.sessionStorage;
	} catch {
		return undefined;
	}
}

function resolveDefaultPosition(): ScrollPosition {
	if (typeof window === 'undefined') return { x: 0, y: 0 };
	return { x: Math.max(0, window.scrollX), y: Math.max(0, window.scrollY) };
}

function resolveDefaultBounds(): { maxX: number; maxY: number } | undefined {
	if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

	const documentWidth = Math.max(
		document.documentElement.scrollWidth,
		document.body?.scrollWidth ?? 0
	);
	const documentHeight = Math.max(
		document.documentElement.scrollHeight,
		document.body?.scrollHeight ?? 0
	);

	return {
		maxX: Math.max(0, documentWidth - window.innerWidth),
		maxY: Math.max(0, documentHeight - window.innerHeight)
	};
}

function normalizeCoordinate(value: number, maximum?: number): number {
	const coordinate = Number.isFinite(value) ? Math.max(0, value) : 0;
	if (maximum === undefined || !Number.isFinite(maximum)) return coordinate;
	return Math.min(coordinate, Math.max(0, maximum));
}

export function createScrollRestoration(options: ScrollRestorationOptions) {
	const storage = options.storage ?? resolveDefaultStorage();
	const maxEntries = Math.max(1, Math.floor(options.maxEntries ?? DEFAULT_MAX_ENTRIES));
	const getScrollPosition = options.getScrollPosition ?? resolveDefaultPosition;
	const scrollTo =
		options.scrollTo ??
		((x: number, y: number) => {
			if (typeof window !== 'undefined') window.scrollTo(x, y);
		});

	function readState(): PersistedScrollState {
		if (!storage) return emptyState();

		try {
			const raw = storage.getItem(options.storageKey);
			if (!raw) return emptyState();

			const parsed: unknown = JSON.parse(raw);
			if (
				!isRecord(parsed) ||
				parsed['version'] !== CURRENT_VERSION ||
				!Array.isArray(parsed['entries'])
			) {
				return emptyState();
			}

			return {
				version: CURRENT_VERSION,
				entries: parsed['entries'].filter(isScrollEntry).slice(0, maxEntries)
			};
		} catch {
			return emptyState();
		}
	}

	function writeState(state: PersistedScrollState): void {
		if (!storage) return;

		try {
			storage.setItem(options.storageKey, JSON.stringify(state));
		} catch {
			// Storage can be unavailable or full; scroll restoration is best effort.
		}
	}

	function routeKey(url: URL): string | undefined {
		try {
			const key = options.getRouteKey(url);
			return key || undefined;
		} catch {
			return undefined;
		}
	}

	function capture(url: URL, position = getScrollPosition()): void {
		const key = routeKey(url);
		if (!key) return;

		const state = readState();
		const entry: ScrollEntry = {
			key,
			x: normalizeCoordinate(position.x),
			y: normalizeCoordinate(position.y)
		};
		state.entries = [entry, ...state.entries.filter((candidate) => candidate.key !== key)].slice(
			0,
			maxEntries
		);
		writeState(state);
	}

	function restore(url: URL): boolean {
		const key = routeKey(url);
		if (!key) return false;

		const state = readState();
		const entry = state.entries.find((candidate) => candidate.key === key);
		if (!entry) return false;

		state.entries = [entry, ...state.entries.filter((candidate) => candidate.key !== key)].slice(
			0,
			maxEntries
		);
		writeState(state);

		const bounds = options.getScrollBounds?.() ?? resolveDefaultBounds();
		scrollTo(
			normalizeCoordinate(entry.x, bounds?.maxX),
			normalizeCoordinate(entry.y, bounds?.maxY)
		);
		return true;
	}

	function clear(): void {
		if (!storage) return;

		try {
			storage.removeItem(options.storageKey);
		} catch {
			// Storage can be unavailable; there is nothing else to clear.
		}
	}

	return { capture, restore, clear };
}
