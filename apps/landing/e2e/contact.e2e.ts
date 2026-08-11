import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const fields = ['name', 'company', 'email', 'phone', 'inquiry-type', 'product-interest', 'message'];
const viewports = [
	{ name: 'mobile', width: 390, height: 844 },
	{ name: 'tablet', width: 768, height: 1024 },
	{ name: 'desktop', width: 1440, height: 1000 }
] as const;

for (const pathname of ['/contact/', '/en/contact/']) {
	for (const viewport of viewports) {
		test(`${pathname} has one accessible contact path at ${viewport.name} width`, async ({
			page
		}) => {
			await page.setViewportSize(viewport);
			await page.addInitScript(() => {
				const testWindow = window as Window & {
					turnstile: {
						render(container: HTMLElement, options: { callback(token: string): void }): string;
						remove(widgetId: string): void;
					};
					turnstileRenderCount: number;
				};
				testWindow.turnstileRenderCount = 0;
				testWindow.turnstile = {
					render(_container, options) {
						testWindow.turnstileRenderCount += 1;
						queueMicrotask(() => options.callback('e2e-token'));
						return `e2e-widget-${testWindow.turnstileRenderCount}`;
					},
					remove() {}
				};
			});

			let submittedPayload: Record<string, unknown> | undefined;
			await page.route('**/api-e2e/contact', async (route) => {
				submittedPayload = route.request().postDataJSON() as Record<string, unknown>;
				await route.fulfill({ status: 204 });
			});
			await page.route('https://www.google.com/**', (route) =>
				route.fulfill({
					contentType: 'text/html',
					body: '<!doctype html><html lang="en"><title>Map</title><main><h1>Map</h1></main></html>'
				})
			);

			await page.goto(pathname);
			await expect(page.locator('form')).toHaveCount(1);
			await expect(page.locator('iframe[title="Map"]')).toHaveCount(1);
			await expect(page.locator('[data-action="turnstile-spin-v1"]')).toHaveCount(1);
			await expect
				.poll(() =>
					page.evaluate(
						() => (window as Window & { turnstileRenderCount: number }).turnstileRenderCount
					)
				)
				.toBe(1);

			for (const field of fields) {
				await expect(page.locator(`#${field}`)).toHaveCount(1);
				await page.locator(`label[for="${field}"]`).click();
				await expect(page.locator(`#${field}`)).toBeFocused();
			}

			const accessibility = await new AxeBuilder({ page }).include('section.bg-bg-page').analyze();
			expect(accessibility.violations).toEqual([]);

			await page.locator('#name').fill('Ada Lovelace');
			await page.locator('#email').fill('ada@example.com');
			await page.locator('#message').fill('Please send specifications.');
			await page.locator('button[type="submit"]').click();
			await expect
				.poll(() => submittedPayload)
				.toMatchObject({
					turnstileToken: 'e2e-token',
					name: 'Ada Lovelace',
					email: 'ada@example.com',
					message: 'Please send specifications.'
				});
			await expect(page.locator('#name')).toHaveValue('');
		});
	}
}
