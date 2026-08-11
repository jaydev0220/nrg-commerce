import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import type { Snippet } from 'svelte';

import Drawer from './Drawer.svelte';
import '../../../routes/layout.css';

describe('editor drawer', () => {
	it('restores body scrolling when an open drawer is unmounted', async () => {
		document.body.style.overflow = 'scroll';
		const first = await render(Drawer, {
			open: true,
			title: '第一個抽屜',
			onclose: vi.fn(),
			children: (() => undefined) as unknown as Snippet
		});
		const second = await render(Drawer, {
			open: true,
			title: '第二個抽屜',
			onclose: vi.fn(),
			children: (() => undefined) as unknown as Snippet
		});

		await expect.poll(() => document.body.style.overflow).toBe('hidden');

		await first.unmount();
		expect(document.body.style.overflow).toBe('hidden');

		await second.unmount();
		expect(document.body.style.overflow).toBe('scroll');
		document.body.style.overflow = '';
	});

	it('positions the open dialog at the right viewport edge', async () => {
		const screen = await render(Drawer, {
			open: true,
			title: '編輯商品',
			onclose: vi.fn(),
			children: (() => undefined) as unknown as Snippet
		});

		const dialog = screen.getByRole('dialog', { name: '編輯商品' });

		await expect.element(dialog).toHaveAttribute('open');
		await expect.element(dialog).toHaveClass('fixed');
		await expect.element(dialog).toHaveClass('inset-y-0');
		await expect.element(dialog).toHaveClass('right-0');
		await expect.element(dialog).toHaveClass('left-auto');
		await expect.element(dialog).toHaveClass('m-0');
		await expect.element(dialog).toHaveClass('h-dvh');
		await expect.element(dialog).toHaveClass('max-h-none');

		const dialogElement = screen.container.querySelector('dialog');
		expect(dialogElement).not.toBeNull();
		if (dialogElement) {
			const box = dialogElement.getBoundingClientRect();
			expect(Math.round(box.x + box.width)).toBe(window.innerWidth);
			expect(Math.round(box.y)).toBe(0);
			expect(Math.round(box.height)).toBe(window.innerHeight);
		}
	});
});
