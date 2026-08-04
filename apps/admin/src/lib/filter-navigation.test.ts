import { beforeEach, describe, expect, it, vi } from 'vitest';

const goto = vi.hoisted(() => vi.fn());

vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/paths', () => ({ resolve: (path: string) => path }));

import { buildFilterQuery, createFilterHandlers } from './filter-navigation';

describe('buildFilterQuery', () => {
	it('keeps selected values, trims text, and omits empty fields', () => {
		expect(
			buildFilterQuery([
				['search', '  northwind  '],
				['status', 'completed'],
				['empty', '   ']
			])
		).toBe('search=northwind&status=completed');
	});
});

describe('createFilterHandlers', () => {
	const formDataValues = new Map<string, string>();

	beforeEach(() => {
		vi.useFakeTimers();
		goto.mockReset();
		formDataValues.clear();
		vi.stubGlobal(
			'FormData',
			class {
				entries() {
					return formDataValues.entries();
				}
			}
		);
	});

	it('does not navigate during composition and schedules once after composition ends', () => {
		const handlers = createFilterHandlers('/orders');
		const form = { isConnected: true } as HTMLFormElement;
		formDataValues.set('search', '台灣');

		handlers.oncompositionstart({ currentTarget: form } as unknown as CompositionEvent);
		handlers.oninput({ currentTarget: form } as unknown as Event);
		vi.advanceTimersByTime(350);
		expect(goto).not.toHaveBeenCalled();

		handlers.oncompositionend({ currentTarget: form } as unknown as CompositionEvent);
		handlers.oninput({ currentTarget: form } as unknown as Event);
		vi.advanceTimersByTime(349);
		expect(goto).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(goto).toHaveBeenCalledTimes(1);
		expect(goto).toHaveBeenCalledWith('/orders?search=%E5%8F%B0%E7%81%A3', {
			invalidateAll: true,
			keepFocus: true,
			replaceState: true
		});
	});

	it('debounces ordinary input and applies select changes immediately', () => {
		const handlers = createFilterHandlers('/products');
		const form = { isConnected: true } as HTMLFormElement;
		formDataValues.set('search', 'glass');

		handlers.oninput({ currentTarget: form } as unknown as Event);
		vi.advanceTimersByTime(349);
		expect(goto).not.toHaveBeenCalled();

		handlers.onchange({ currentTarget: form } as unknown as Event);
		expect(goto).toHaveBeenCalledTimes(1);
		expect(goto).toHaveBeenCalledWith('/products?search=glass', {
			invalidateAll: true,
			keepFocus: true,
			replaceState: true
		});

		vi.advanceTimersByTime(350);
		expect(goto).toHaveBeenCalledTimes(1);
	});

	it('does not navigate after the form is disconnected', () => {
		const handlers = createFilterHandlers('/logs');
		const form = { isConnected: false } as HTMLFormElement;
		formDataValues.set('requestId', 'request-1');

		handlers.oninput({ currentTarget: form } as unknown as Event);
		vi.advanceTimersByTime(350);

		expect(goto).not.toHaveBeenCalled();
	});
});
