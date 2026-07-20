import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/api/admin-api', () => ({ loadProductEditorData: vi.fn() }));

const { prerender } = await import('./+page');

describe('product editor route', () => {
	it('uses the SPA fallback for dynamic product identifiers', () => {
		expect(prerender).toBe(false);
	});
});
