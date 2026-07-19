import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
	requestJson: vi.fn(),
	requestNoContent: vi.fn(),
	refreshSession: vi.fn(),
	clearCsrfToken: vi.fn()
}));

vi.mock('./client', () => {
	class AdminApiError extends Error {
		constructor(
			readonly status: number,
			readonly code: string,
			message = code
		) {
			super(message);
		}
	}

	return { AdminApiError, adminApiClient: client };
});

import {
	AdminApiError,
	beginManagedPasskeyRegistration,
	beginSecurityPasskeyReauth,
	beginSecurityTotpSetup,
	bulkUpdateProducts,
	changeCurrentPassword,
	completeManagedPasskeyRegistration,
	completeSecurityPasskeyReauth,
	completeSecurityTotpSetup,
	createImageUploadTarget,
	createOrder,
	createProductSku,
	createStaff,
	deleteProductImage,
	deleteProductSku,
	deleteStaff,
	formatDate,
	getOptionalCurrentStaff,
	loadOrderSkuLookups,
	loadProductEditorData,
	loadSecuritySettingsData,
	loadStaffPageData,
	registerProductImage,
	removeManagedPasskey,
	removeSecurityTotp,
	renameManagedPasskey,
	resetStaffMfa,
	resetStaffPassword,
	restoreProductImage,
	restoreStaff,
	revokeAuthSession,
	revokeOtherAuthSessions,
	updateMfaPreference,
	updateOrderStatus,
	updateProductImageCrop,
	updateProductSku,
	updateStaff,
	verifySecurityPassword,
	verifySecurityTotp
} from './admin-api';

beforeEach(() => {
	client.requestJson.mockReset();
	client.requestNoContent.mockReset();
	client.refreshSession.mockReset();
	client.clearCsrfToken.mockReset();
	client.requestJson.mockResolvedValue({});
	client.requestNoContent.mockResolvedValue(undefined);
});

describe('admin API security contracts', () => {
	it('loads security records and revives timestamp fields', async () => {
		client.requestJson
			.mockResolvedValueOnce({
				data: [
					{
						id: 'session-1',
						authenticatedAt: '2026-07-19T00:00:00.000Z',
						expiresAt: '2026-07-20T00:00:00.000Z'
					}
				]
			})
			.mockResolvedValueOnce({
				data: [{ id: 'passkey-1', verifiedAt: '2026-07-19T01:00:00.000Z' }]
			});

		const result = await loadSecuritySettingsData();

		expect(result.sessions[0]?.authenticatedAt).toBeInstanceOf(Date);
		expect(result.sessions[0]?.expiresAt).toBeInstanceOf(Date);
		expect(result.passkeys[0]?.verifiedAt).toBeInstanceOf(Date);
		expect(client.requestJson.mock.calls.map(([path]) => path)).toEqual([
			'/api/auth/sessions',
			'/api/auth/passkeys'
		]);
	});

	it('maps an authentication 401 to an absent optional staff record', async () => {
		client.requestJson.mockRejectedValueOnce(
			new AdminApiError(401, 'AUTHENTICATION_REQUIRED', 'Sign in required')
		);

		await expect(getOptionalCurrentStaff()).resolves.toBeNull();
		client.requestJson.mockRejectedValueOnce(new Error('network failure'));
		await expect(getOptionalCurrentStaff()).rejects.toThrow('network failure');
	});

	it('uses the expected methods and payloads for security mutations', async () => {
		await revokeAuthSession('session-1');
		await revokeOtherAuthSessions();
		await changeCurrentPassword({ currentPassword: 'old', newPassword: 'new-password' });
		await updateMfaPreference({ preferredMfaMethod: 'passkey' });
		await verifySecurityPassword({
			action: 'remove_totp',
			targetId: null,
			password: 'password'
		});
		await verifySecurityTotp({ action: 'remove_passkey', targetId: 'key-1', code: '123456' });
		await beginSecurityPasskeyReauth({ action: 'rename_passkey', targetId: 'key-1' });
		await completeSecurityPasskeyReauth({ id: 'credential' });
		await beginSecurityTotpSetup();
		await completeSecurityTotpSetup('123456');
		await removeSecurityTotp();
		await beginManagedPasskeyRegistration('Laptop');
		await completeManagedPasskeyRegistration({ id: 'credential' });
		await renameManagedPasskey('key-1', 'Security key');
		await removeManagedPasskey('key-1');

		expect(client.requestNoContent).toHaveBeenCalledWith('/api/auth/sessions/session-1', {
			method: 'DELETE'
		});
		expect(client.requestNoContent).toHaveBeenCalledWith(
			'/api/auth/security/reauth/totp',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({
					action: 'remove_passkey',
					targetId: 'key-1',
					code: '123456'
				})
			})
		);
		expect(client.requestJson).toHaveBeenCalledWith(
			'/api/auth/passkeys/key-1',
			expect.objectContaining({
				method: 'PATCH',
				body: JSON.stringify({ nickname: 'Security key' })
			}),
			{}
		);
	});
});

describe('admin API product contracts', () => {
	it('loads an editor with all category pages and deleted images per SKU', async () => {
		client.requestJson.mockImplementation(async (path: string) => {
			if (path.startsWith('/api/management/products/product-1?')) {
				return {
					id: 'product-1',
					createdAt: '2026-07-19T00:00:00.000Z',
					skus: [{ id: 'sku-1' }, { id: 'sku-2' }]
				};
			}
			if (path.includes('/categories?') && path.includes('page=1')) {
				return { data: [{ id: 'category-1' }], pagination: { totalPages: 2 } };
			}
			if (path.includes('/categories?') && path.includes('page=2')) {
				return { data: [{ id: 'category-2' }], pagination: { totalPages: 2 } };
			}
			if (path.includes('/images?state=deleted')) {
				return {
					data: [{ id: `deleted-${path.includes('sku-1') ? '1' : '2'}` }],
					pagination: { totalPages: 1 }
				};
			}
			throw new Error(`Unexpected request: ${path}`);
		});

		const result = await loadProductEditorData('product-1');

		expect(result.product.createdAt).toBeInstanceOf(Date);
		expect(result.categories.map((category) => category.id)).toEqual(['category-1', 'category-2']);
		expect(result.deletedImages).toEqual({
			'sku-1': [{ id: 'deleted-1' }],
			'sku-2': [{ id: 'deleted-2' }]
		});
	});

	it('preserves SKU, image, and bulk product mutation contracts', async () => {
		await createProductSku({
			productId: 'product-1',
			skuCode: 'SKU-1',
			price: 100,
			attributes: { size: 'large' }
		});
		await updateProductSku('sku-1', { price: 120 });
		await deleteProductSku('sku-1');
		await createImageUploadTarget('sku-1', {
			fileName: 'image.webp',
			contentType: 'image/webp',
			fileSize: 1024
		});
		await registerProductImage('sku-1', {
			uploadId: 'upload-1',
			altText: 'Product',
			type: 'gallery'
		});
		await updateProductImageCrop('sku-1', 'image-1', {
			focusX: 0.25,
			focusY: 0.75,
			zoom: 1.5
		});
		await deleteProductImage('sku-1', 'image-1', { force: true, deleteAsset: true });
		await restoreProductImage('sku-1', 'image-1');
		await bulkUpdateProducts({ productIds: ['product-1'], action: 'publish' });

		expect(client.requestJson).toHaveBeenCalledWith(
			'/api/management/products/skus/sku-1/images/image-1?force=true&deleteAsset=true',
			{ method: 'DELETE' },
			{}
		);
		expect(client.requestNoContent).toHaveBeenCalledWith('/api/management/products/skus/sku-1', {
			method: 'DELETE'
		});
	});
});

describe('admin API staff and order contracts', () => {
	it('loads role and paginated staff data with stable management page size', async () => {
		client.requestJson.mockImplementation(async (path: string) => {
			if (path === '/api/management/staff/roles') return [{ id: 'role-1' }];
			if (path.startsWith('/api/management/staff?')) {
				return {
					data: [{ id: 'staff-1', createdAt: '2026-07-19T00:00:00.000Z' }],
					pagination: { page: 2, limit: 20, total: 1, totalPages: 1 }
				};
			}
			throw new Error(`Unexpected request: ${path}`);
		});

		const result = await loadStaffPageData(new URLSearchParams({ page: '2', search: 'Ada' }));

		expect(result.roles).toEqual([{ id: 'role-1' }]);
		expect(result.staff[0]?.createdAt).toBeInstanceOf(Date);
		expect(client.requestJson).toHaveBeenCalledWith(
			'/api/management/staff?page=2&search=Ada&limit=20',
			{},
			{}
		);
	});

	it('preserves staff security and lifecycle endpoints', async () => {
		await createStaff({ email: 'ada@example.com', name: 'Ada', roleIds: ['role-1'] });
		await updateStaff('staff-1', { status: 'suspended', roleIds: ['role-2'] });
		await deleteStaff('staff-1');
		await restoreStaff('staff-1');
		await resetStaffMfa('staff-1');
		await resetStaffPassword('staff-1');

		expect(client.requestNoContent).toHaveBeenCalledWith('/api/management/staff/staff-1', {
			method: 'DELETE'
		});
		expect(client.requestNoContent).toHaveBeenCalledWith(
			'/api/management/staff/staff-1/mfa/reset',
			{ method: 'POST', body: '{}' }
		);
		expect(client.requestJson).toHaveBeenCalledWith(
			'/api/management/staff/staff-1/password/reset',
			expect.objectContaining({ method: 'POST' }),
			{}
		);
	});

	it('trims SKU lookup search and sends order idempotency and status payloads', async () => {
		await loadOrderSkuLookups('  SKU-100  ');
		await createOrder(
			{
				businessId: null,
				items: [
					{
						skuCode: 'SKU-100',
						productName: 'Beaker',
						unitPrice: 100,
						quantity: 2,
						attributes: {}
					}
				]
			},
			'idempotency-1'
		);
		await updateOrderStatus('order-1', 'completed');

		expect(client.requestJson).toHaveBeenCalledWith(
			'/api/management/orders/product-skus?search=SKU-100&page=1&limit=20',
			{},
			{}
		);
		expect(client.requestJson).toHaveBeenCalledWith(
			'/api/management/orders',
			expect.objectContaining({
				method: 'POST',
				headers: { 'idempotency-key': 'idempotency-1' }
			}),
			{}
		);
		expect(client.requestJson).toHaveBeenCalledWith(
			'/api/management/orders/order-1/status',
			expect.objectContaining({
				method: 'PATCH',
				body: JSON.stringify({ status: 'completed' })
			}),
			{}
		);
	});
});

it('formats absent dates without invoking Intl', () => {
	expect(formatDate(null)).toBe('尚無資料');
});
