import { expect, test } from '@playwright/test';

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

test('browses, searches, configures a product, and carries its SKU to inquiry', async ({
	page
}) => {
	const response = await page.goto('/en/');
	const contentSecurityPolicy = response?.headers()['content-security-policy'] ?? '';
	expect(contentSecurityPolicy).toContain("default-src 'self'");
	expect(contentSecurityPolicy).toContain("script-src-attr 'none'");
	expect(contentSecurityPolicy).toContain("object-src 'none'");
	expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");

	await expect(page.getByRole('heading', { name: 'Laboratory Beaker' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Glass Funnel' })).toBeVisible();

	await page.goto('/en/?q=beaker');
	await expect(page.getByRole('searchbox')).toHaveValue('beaker');
	await expect(page.getByRole('heading', { name: 'Laboratory Beaker' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Glass Funnel' })).toHaveCount(0);

	await page.getByRole('heading', { name: 'Laboratory Beaker' }).getByRole('link').click();
	await expect(page).toHaveURL(/\/en\/laboratory-beaker$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Laboratory Beaker' })).toBeVisible();
	await expect
		.poll(async () => structuredType(page, 'ProductGroup'))
		.toMatchObject({
			variesBy: ['https://schema.org/size']
		});

	await page.getByRole('radio', { name: '250 ml' }).click();
	await expect(page).toHaveURL((url) => url.searchParams.get('sku') === 'BEAKER-250');
	await expect(page.getByText('BEAKER-250', { exact: true })).toBeVisible();
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
		'href',
		'http://127.0.0.1:4175/en/laboratory-beaker?sku=BEAKER-250'
	);
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index,follow');
	await expect(page.locator('link[rel="alternate"][hreflang="zh-TW"]')).toHaveAttribute(
		'href',
		'http://127.0.0.1:4175/laboratory-beaker?sku=BEAKER-250'
	);
	await expect
		.poll(async () => structuredType(page, 'Product'))
		.toMatchObject({
			sku: 'BEAKER-250',
			url: 'http://127.0.0.1:4175/en/laboratory-beaker?sku=BEAKER-250'
		});
	await page.locator('#product-content a[href*="/inquiry?sku="]').click();

	await expect(page).toHaveURL((url) => {
		return url.pathname === '/en/inquiry' && url.searchParams.get('sku') === 'BEAKER-250';
	});
	await expect(page.locator('#inquiry-sku')).toHaveValue('BEAKER-250');
});

test('server-renders SKU deep links and normalizes noncanonical queries', async ({
	browser,
	page
}) => {
	const noJavaScriptContext = await browser.newContext({ javaScriptEnabled: false });
	try {
		const noJavaScriptPage = await noJavaScriptContext.newPage();
		await noJavaScriptPage.goto('/en/laboratory-beaker?sku=BEAKER-250');
		await expect(noJavaScriptPage.getByText('BEAKER-250', { exact: true })).toBeVisible();
		expect(await structuredType(noJavaScriptPage, 'Product')).toMatchObject({
			sku: 'BEAKER-250',
			url: 'http://127.0.0.1:4175/en/laboratory-beaker?sku=BEAKER-250'
		});
	} finally {
		await noJavaScriptContext.close();
	}

	await page.goto('/en/laboratory-beaker?sku=BEAKER-250&utm_source=e2e');
	await expect(page.getByText('BEAKER-250', { exact: true })).toBeVisible();
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
		'href',
		'http://127.0.0.1:4175/en/laboratory-beaker?sku=BEAKER-250'
	);

	await page.goto('/en/laboratory-beaker?sku=UNKNOWN');
	await expect(page).toHaveURL('http://127.0.0.1:4175/en/laboratory-beaker');
	await expect(page.getByText('BEAKER-100', { exact: true })).toBeVisible();
});

test('keeps catalog SEO identities and brand links localized', async ({ page }) => {
	await page.goto('/en/');

	await expect(page.locator('a[aria-label="NRG Labware"]')).toHaveAttribute(
		'href',
		'https://www.nrglabware.com/en/'
	);
	await expect(page.locator('a[aria-label="NRG"]')).toHaveCount(2);
	await expect(page.locator('a[aria-label="NRG"]').first()).toHaveAttribute(
		'href',
		'https://www.nrglabware.com/en/'
	);
	await expect
		.poll(async () => structuredType(page, 'Organization'))
		.toMatchObject({
			'@id': 'https://www.nrglabware.com/#organization',
			url: 'https://www.nrglabware.com/'
		});
	await expect
		.poll(async () => structuredType(page, 'WebSite'))
		.toMatchObject({
			'@id': 'http://127.0.0.1:4175/#website',
			publisher: { '@id': 'https://www.nrglabware.com/#organization' }
		});
});

test('returns a non-indexable catalog 404 without misleading page metadata', async ({ page }) => {
	const response = await page.goto('/en/does-not-exist');
	expect(response?.status()).toBe(404);
	await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible();
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
	await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
	await expect(page.locator('link[rel="alternate"]')).toHaveCount(0);
	await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
	await expect(page.locator('#error-content a').first()).toBeVisible();
});

test('restores exact scroll positions across locale switches, reloads, and history', async ({
	page
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.addInitScript(() => {
		const style = document.createElement('style');
		style.textContent = 'html, body { min-height: 3200px !important; }';
		document.documentElement.append(style);
	});

	await page.goto('/en/?q=beaker');
	await page.evaluate(() => window.scrollTo(0, 400));
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(400);

	await page.getByRole('button', { name: 'Switch language' }).first().click();
	await page.getByRole('option', { name: '繁體中文', exact: true }).click();
	await expect(page).toHaveURL(/\/\?q=beaker$/u);
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(400);

	await page.reload();
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(400);

	await page.getByRole('heading', { name: '實驗室燒杯' }).getByRole('link').click();
	await expect(page).toHaveURL(/\/laboratory-beaker$/u);
	await page.evaluate(() => window.scrollTo(0, 360));
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(360);

	await page.goBack();
	await expect(page).toHaveURL(/\/\?q=beaker$/u);
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(400);

	await page.goForward();
	await expect(page).toHaveURL(/\/laboratory-beaker$/u);
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(360);
});
