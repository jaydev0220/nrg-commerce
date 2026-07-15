import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';

import ProductImageFocusPicker from './ProductImageFocusPicker.svelte';

function setupPreview(screen: Awaited<ReturnType<typeof render>>) {
	const preview = screen.container.querySelector('[role="group"]') as HTMLDivElement;
	const image = screen.container.querySelector('img') as HTMLImageElement;
	Object.defineProperty(preview, 'getBoundingClientRect', {
		value: () => ({ left: 0, top: 0, width: 200, height: 200 })
	});
	Object.defineProperty(image, 'naturalWidth', { value: 400 });
	Object.defineProperty(image, 'naturalHeight', { value: 200 });
	preview.setPointerCapture = vi.fn();
	preview.hasPointerCapture = vi.fn(() => false);
	preview.releasePointerCapture = vi.fn();
	return { preview, image };
}

function pointer(type: string, init: PointerEventInit): PointerEvent {
	return new PointerEvent(type, { bubbles: true, ...init });
}

describe('product image crop picker', () => {
	it('keeps the marker centered and updates crop position by dragging the image', async () => {
		const onchange = vi.fn();
		const screen = await render(ProductImageFocusPicker, {
			imageUrl: 'https://assets.example.com/image.png',
			altText: '商品縮圖',
			onchange
		});
		const { preview } = setupPreview(screen);

		const marker = screen.container.querySelector('span[aria-hidden="true"]') as HTMLElement;
		expect(marker).not.toBeNull();
		preview.dispatchEvent(
			pointer('pointerdown', {
				pointerId: 1,
				pointerType: 'mouse',
				button: 0,
				clientX: 100,
				clientY: 100
			})
		);
		preview.dispatchEvent(
			pointer('pointermove', { pointerId: 1, pointerType: 'mouse', clientX: 150, clientY: 100 })
		);

		expect(onchange).toHaveBeenLastCalledWith({ focusX: 0.25, focusY: 0.5, zoom: 1 });
		await expect
			.element(screen.getByRole('group', { name: '縮圖裁切預覽' }))
			.toHaveClass('cursor-grabbing');
	});

	it('supports wheel zoom and reset without keyboard panning', async () => {
		const onchange = vi.fn();
		const screen = await render(ProductImageFocusPicker, {
			imageUrl: 'https://assets.example.com/image.png',
			altText: '商品縮圖',
			initialFocusX: 0.2,
			initialFocusY: 0.8,
			initialZoom: 2,
			onchange
		});
		const { preview } = setupPreview(screen);

		const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 500 });
		preview.dispatchEvent(wheel);
		expect(wheel.defaultPrevented).toBe(true);
		expect(onchange).toHaveBeenLastCalledWith({ focusX: 0.2, focusY: 0.8, zoom: 1.5 });

		await screen.getByRole('button', { name: '重設置中' }).click();
		expect(onchange).toHaveBeenLastCalledWith({ focusX: 0.5, focusY: 0.5, zoom: 1 });
	});

	it('supports pinch zoom while preserving the crop position', async () => {
		const onchange = vi.fn();
		const screen = await render(ProductImageFocusPicker, {
			imageUrl: 'https://assets.example.com/image.png',
			altText: '商品縮圖',
			initialFocusX: 0.3,
			initialFocusY: 0.7,
			onchange
		});
		const { preview } = setupPreview(screen);

		preview.dispatchEvent(
			pointer('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 50, clientY: 100 })
		);
		preview.dispatchEvent(
			pointer('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 150, clientY: 100 })
		);
		preview.dispatchEvent(
			pointer('pointermove', { pointerId: 2, pointerType: 'touch', clientX: 200, clientY: 100 })
		);

		expect(onchange).toHaveBeenLastCalledWith({ focusX: 0.3, focusY: 0.7, zoom: 1.5 });
	});
});
