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
					body: '<!doctype html><html lang="en"><title>Map</title><main aria-label="Map"><h1>Map</h1></main></html>'
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

function findStructuredType(value: unknown, type: string): Record<string, unknown> | undefined {
	if (Array.isArray(value)) {
		return value.map((entry) => findStructuredType(entry, type)).find(Boolean);
	}
	if (!value || typeof value !== 'object') return undefined;

	const record = value as Record<string, unknown>;
	if (record['@type'] === type) return record;
	return Object.values(record)
		.map((entry) => findStructuredType(entry, type))
		.find(Boolean);
}

async function structuredType(page: import('@playwright/test').Page, type: string) {
	const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
	return scripts.map((script) => findStructuredType(JSON.parse(script), type)).find(Boolean);
}

test('localized pages expose canonical SEO and custom-manufacturing content', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.addInitScript(() => {
		const testWindow = window as Window & {
			turnstile: {
				render(container: HTMLElement, options: { callback(token: string): void }): string;
				remove(widgetId: string): void;
			};
		};
		testWindow.turnstile = {
			render(_container, options) {
				queueMicrotask(() => options.callback('e2e-token'));
				return 'e2e-widget';
			},
			remove() {}
		};
	});
	await page.route('https://www.google.com/**', (route) =>
		route.fulfill({
			contentType: 'text/html',
			body: '<!doctype html><html lang="en"><title>Map</title><main aria-label="Map"><h1>Map</h1></main></html>'
		})
	);
	for (const pathname of [
		'/',
		'/en/',
		'/about/',
		'/en/about/',
		'/capabilities/',
		'/en/capabilities/',
		'/contact/',
		'/en/contact/',
		'/privacy/',
		'/en/privacy/'
	]) {
		const response = await page.goto(pathname);
		expect(response?.status()).toBe(200);
		await expect(page.locator('h1')).toHaveCount(1);
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
			'href',
			`http://127.0.0.1:4178${pathname}`
		);
		await expect(page.locator('link[rel="alternate"]')).toHaveCount(3);
		await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
		await expect
			.poll(async () => structuredType(page, 'Organization'))
			.toMatchObject({
				'@id': 'http://127.0.0.1:4178/#organization',
				name: 'NEW GLATEC Co., Ltd.',
				legalName: '巧新有限公司',
				brand: { '@type': 'Brand', name: 'NRG Glass' }
			});
		if (pathname !== '/' && pathname !== '/en/') {
			await expect
				.poll(async () => structuredType(page, 'BreadcrumbList'))
				.toMatchObject({
					'@type': 'BreadcrumbList'
				});
		}
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);
		const accessibility = await new AxeBuilder({ page }).include('main').analyze();
		expect(accessibility.violations).toEqual([]);
	}

	await page.goto('/en/');
	await expect(page.getByText('Tailored', { exact: true })).toBeVisible();
	await expect(page.getByText('Custom Manufacturing Available', { exact: true })).toBeVisible();
	await expect(page.locator('a[aria-label="NRG Labware"]')).toHaveAttribute('href', '/en/');
	await expect(page.locator('a[aria-label="NRG"]')).toHaveCount(2);
	await expect(page.locator('a[aria-label="NRG"]').first()).toHaveAttribute('href', '/en/');
});

test('B2B contact links preselect enterprise guidance and expose the privacy notice', async ({
	page
}) => {
	await page.goto('/en/contact/?type=b2b');
	await expect(page.locator('#inquiry-type')).toHaveValue('Enterprise (B2B)');
	await expect(page.getByText('We aim to respond within two business days.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Read the privacy notice' })).toHaveAttribute(
		'href',
		'/en/privacy'
	);
	await expect(page.getByText(/dimensions or specification, quantity, destination/)).toBeVisible();
});

test('unknown localized pages return a useful non-indexable 404', async ({ page }) => {
	const response = await page.goto('/en/does-not-exist/');
	expect(response?.status()).toBe(404);
	await expect(page.getByRole('heading', { name: /Page not found/ })).toBeVisible();
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
	await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
	await expect(page.locator('link[rel="alternate"]')).toHaveCount(0);
	await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
	await expect(page.getByRole('link', { name: /English home/ })).toHaveAttribute('href', '/en/');
});
