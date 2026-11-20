import { expect, test } from '@playwright/test';

test('stacks full-width product cards without overlap on mobile', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/en/');

	const cards = page.locator('.product-grid .product-card');
	await expect(cards).toHaveCount(5);

	const boxes = await cards.evaluateAll((elements) =>
		elements.map((element) => {
			const { left, top, width, bottom } = element.getBoundingClientRect();
			return { left, top, width, bottom };
		})
	);
	const first = boxes[0];
	if (!first) throw new Error('Expected the first product card.');

	for (let index = 1; index < boxes.length; index += 1) {
		const previous = boxes[index - 1];
		const current = boxes[index];
		if (!previous || !current) throw new Error('Expected five product card positions.');

		expect(current.left).toBeCloseTo(first.left, 2);
		expect(current.width).toBeCloseTo(first.width, 2);
		expect(current.top).toBeGreaterThanOrEqual(previous.bottom);
	}
});
