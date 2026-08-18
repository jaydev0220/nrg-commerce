import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';

import ProductStructuredFieldsEditor from './ProductStructuredFieldsEditor.svelte';

async function openEditor(screen: Awaited<ReturnType<typeof render>>) {
	await screen.getByText('進階結構化資料', { exact: true }).click();
}

describe('ProductStructuredFieldsEditor', () => {
	it('shows translated preset options and selected field headings', async () => {
		const screen = await render(ProductStructuredFieldsEditor, {
			attributes: {},
			value: { color: 'clear' }
		});

		await openEditor(screen);

		await expect.element(screen.getByRole('combobox')).toHaveTextContent('材質');
		await expect.element(screen.getByRole('combobox')).toHaveTextContent('自訂屬性');
		await expect.element(screen.getByText('顏色', { exact: true })).toBeVisible();
		await expect.element(screen.getByText('Color', { exact: true })).not.toBeInTheDocument();
	});

	it('keeps canonical English JSON-LD keys and values behind translated controls', async () => {
		const screen = await render(ProductStructuredFieldsEditor, {
			attributes: {},
			value: { sterility: 'aseptic' }
		});

		await openEditor(screen);
		await expect.element(screen.getByText('滅菌狀態', { exact: true })).toBeVisible();
		expect(screen.getByText('無菌操作', { exact: true })).toBeInTheDocument();

		await screen.getByText('預覽產生的 SKU JSON-LD 片段', { exact: true }).click();
		await expect.element(screen.getByText(/"name": "sterility"/u)).toBeVisible();
		await expect.element(screen.getByText(/"value": "aseptic"/u)).toBeVisible();
	});
});
