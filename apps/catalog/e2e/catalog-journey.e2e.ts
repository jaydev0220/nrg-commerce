import { expect, test } from '@playwright/test';

test('browses, searches, configures a product, and carries its SKU to inquiry', async ({
	page
}) => {
	await page.goto('/en/');

	await expect(page.getByRole('heading', { name: 'Laboratory Beaker' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Glass Funnel' })).toBeVisible();

	await page.goto('/en/?q=beaker');
	await expect(page.getByRole('searchbox')).toHaveValue('beaker');
	await expect(page.getByRole('heading', { name: 'Laboratory Beaker' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Glass Funnel' })).toHaveCount(0);

	await page.getByRole('heading', { name: 'Laboratory Beaker' }).getByRole('link').click();
	await expect(page).toHaveURL(/\/en\/laboratory-beaker$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Laboratory Beaker' })).toBeVisible();

	await page.getByRole('radio', { name: '250 ml' }).click();
	await expect(page.getByText('BEAKER-250', { exact: true })).toBeVisible();
	await page.locator('#product-content a[href*="/inquiry?sku="]').click();

	await expect(page).toHaveURL((url) => {
		return url.pathname === '/en/inquiry' && url.searchParams.get('sku') === 'BEAKER-250';
	});
	await expect(page.locator('#inquiry-sku')).toHaveValue('BEAKER-250');
});
