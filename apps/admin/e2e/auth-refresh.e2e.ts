import { expect, test } from '@playwright/test';

test('serves the SPA shell for a dynamic product editor deep link', async ({ page }) => {
	await page.route('**/api/**', async (route) => {
		const pathname = new URL(route.request().url()).pathname;
		if (pathname === '/api/auth/me') {
			await route.fulfill({
				status: 401,
				json: { error: { code: 'UNAUTHENTICATED', message: 'Unauthenticated' } }
			});
			return;
		}
		if (pathname === '/api/auth/state') {
			await route.fulfill({ json: { status: 'unauthenticated' } });
			return;
		}
		await route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND' } } });
	});

	const response = await page.goto('/products/deep-link-product');

	expect(response?.status()).toBe(200);
	await expect(page).toHaveURL(/\/login\?reason=session-expired$/);
});

test('two tabs share one refresh and both finish their protected loads', async ({ context }) => {
	let authenticated = false;
	let expiredRequestCount = 0;
	let refreshCount = 0;
	let releaseExpiredRequests: (() => void) | undefined;
	const bothTabsExpired = new Promise<void>((resolve) => {
		releaseExpiredRequests = resolve;
	});
	const staff = {
		id: 'staff-id',
		email: 'admin@example.com',
		name: '管理員',
		status: 'active',
		preferredMfaMethod: 'authenticator',
		lastLoginAt: '2026-07-15T00:00:00.000Z',
		roles: [],
		totpCredentialCount: 1,
		passkeyCredentialCount: 0
	};
	const dashboard = {
		metrics: [
			{
				key: 'completedSales',
				value: 0,
				comparison: 0,
				comparisonKind: 'percent',
				reference: 'previousMonth'
			}
		],
		trend: { range: 'days', series: [] },
		topProducts: []
	};

	await context.route('**/api/**', async (route) => {
		const pathname = new URL(route.request().url()).pathname;
		if (pathname === '/api/auth/me') {
			if (!authenticated) {
				expiredRequestCount += 1;
				if (expiredRequestCount === 2) releaseExpiredRequests?.();
			}
			await route.fulfill({
				status: authenticated ? 200 : 401,
				json: authenticated
					? { staff, sessionId: 'session-id', mfaMethods: ['authenticator'] }
					: { error: { code: 'ACCESS_TOKEN_EXPIRED', message: 'Expired' } }
			});
			return;
		}
		if (pathname === '/api/auth/state') {
			await route.fulfill({
				json: { status: authenticated ? 'authenticated' : 'refresh_required' }
			});
			return;
		}
		if (pathname === '/api/auth/csrf') {
			await route.fulfill({ json: { csrfToken: 'csrf-token' } });
			return;
		}
		if (pathname === '/api/auth/refresh') {
			refreshCount += 1;
			await bothTabsExpired;
			authenticated = true;
			await route.fulfill({ json: { status: 'authenticated' } });
			return;
		}
		if (pathname === '/api/management/dashboard') {
			await route.fulfill({ json: dashboard });
			return;
		}
		await route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND' } } });
	});

	const firstPage = await context.newPage();
	const secondPage = await context.newPage();
	await Promise.all([firstPage.goto('/'), secondPage.goto('/')]);

	await expect(firstPage.getByRole('heading', { name: '完成銷售趨勢' })).toBeVisible();
	await expect(secondPage.getByRole('heading', { name: '完成銷售趨勢' })).toBeVisible();
	expect(expiredRequestCount).toBe(2);
	expect(refreshCount).toBe(1);
});
