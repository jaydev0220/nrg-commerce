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
			message: string,
			readonly code: string | null = null,
			readonly details: unknown = null
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

const ids = {
	session: '00000000-0000-4000-8000-000000000001',
	staff: '00000000-0000-4000-8000-000000000002',
	passkey: '00000000-0000-4000-8000-000000000003',
	role: '00000000-0000-4000-8000-000000000004',
	product: '00000000-0000-4000-8000-000000000005',
	sku: '00000000-0000-4000-8000-000000000006',
	image: '00000000-0000-4000-8000-000000000007',
	category: '00000000-0000-4000-8000-000000000008',
	upload: '00000000-0000-4000-8000-000000000009',
	order: '00000000-0000-4000-8000-000000000010'
} as const;
const timestamp = '2026-07-19T00:00:00.000Z';

const roleRecord = {
	id: ids.role,
	key: 'admin',
	name: 'Administrator',
	permissions: ['product.read']
};
const staffRecord = {
	id: ids.staff,
	email: 'ada@example.com',
	name: 'Ada',
	status: 'active',
	preferredMfaMethod: null,
	lastLoginAt: null,
	deletedAt: null,
	createdAt: timestamp,
	updatedAt: timestamp,
	roles: [roleRecord]
};
const sessionRecord = {
	id: ids.session,
	staffId: ids.staff,
	userAgent: null,
	ipAddress: null,
	authenticatedAt: timestamp,
	lastSeenAt: null,
	expiresAt: '2026-07-20T00:00:00.000Z',
	revokedAt: null
};
const passkeyRecord = {
	id: ids.passkey,
	nickname: 'Security key',
	deviceType: 'multiDevice',
	backedUp: true,
	verifiedAt: timestamp,
	lastUsedAt: null
};
const categoryRecord = {
	id: ids.category,
	name: 'Glassware',
	nameEn: null,
	slug: 'glassware',
	description: null,
	descriptionEn: null,
	position: 0,
	parentId: null,
	deletedAt: null,
	createdAt: timestamp,
	updatedAt: timestamp
};
const imageRecord = {
	id: ids.image,
	productId: ids.product,
	skuId: null,
	imageUrl: 'https://cdn.example.test/products/image.webp',
	assetKey: 'products/image.webp',
	altText: 'Product',
	placement: 'shared-gallery',
	position: 0,
	focusX: null,
	focusY: null,
	zoom: null,
	deletedAt: null,
	createdAt: timestamp,
	updatedAt: timestamp
};
const skuRecord = {
	id: ids.sku,
	productId: ids.product,
	productSlug: 'glassware',
	skuCode: 'SKU-1',
	name: 'Glassware',
	nameEn: null,
	description: null,
	descriptionEn: null,
	categoryId: ids.category,
	categorySlug: 'glassware',
	price: 100,
	stockQuantity: 8,
	availability: 'in_stock',
	published: true,
	attributes: {},
	deletedAt: null,
	createdAt: timestamp,
	updatedAt: timestamp,
	images: []
};
const productRecord = {
	id: ids.product,
	slug: 'glassware',
	name: 'Glassware',
	nameEn: null,
	description: null,
	descriptionEn: null,
	categoryId: ids.category,
	categorySlug: 'glassware',
	published: true,
	deletedAt: null,
	createdAt: timestamp,
	updatedAt: timestamp,
	thumbnail: null,
	images: [],
	skus: [skuRecord]
};
const orderRecord = {
	id: ids.order,
	businessId: null,
	status: 'pending',
	customerName: 'Consumer',
	customerEmail: null,
	customerPhone: '1234567',
	customerAddress: null,
	itemCount: 0,
	subtotalAmount: 0,
	discountLabelId: null,
	discountLabelName: null,
	suggestedDiscountRate: null,
	discountRate: 0,
	discountAmount: 0,
	totalAmount: 0,
	version: 0,
	completedAt: null,
	cancelledAt: null,
	refundedAt: null,
	createdAt: timestamp,
	updatedAt: timestamp,
	business: null,
	items: []
};

function paginated(data: unknown[]) {
	return { data, pagination: { page: 1, limit: 20, total: data.length, totalPages: 1 } };
}

type ApiResponseHandler = {
	matches: (path: string, init: RequestInit) => boolean;
	response: unknown;
};

const defaultApiResponses: ApiResponseHandler[] = [
	{
		matches: (path) => path === '/api/auth/sessions/revoke-others',
		response: { revokedCount: 1 }
	},
	{
		matches: (path) => path === '/api/auth/password',
		response: { status: 'authenticated' }
	},
	{
		matches: (path) => path.includes('/passkey/') || path.endsWith('/registration/options'),
		response: { options: { challenge: 'challenge' } }
	},
	{
		matches: (path) => path.endsWith('/totp/setup'),
		response: {
			secret: 'secret',
			otpauthUrl: 'otpauth://totp/example?secret=secret',
			digits: 6,
			period: 30
		}
	},
	{
		matches: (path) =>
			path.endsWith('/registration/verify') || path.includes('/api/auth/passkeys/'),
		response: passkeyRecord
	},
	{ matches: (path) => path.includes('/products/skus'), response: skuRecord },
	{
		matches: (path) => path.endsWith('/images/upload-url'),
		response: {
			uploadId: ids.upload,
			uploadUrl: 'https://uploads.example.test/image',
			assetKey: 'uploads/image.webp',
			expiresAt: timestamp
		}
	},
	{
		matches: (path, init) => path.includes('/images/') && init.method === 'DELETE',
		response: { deleted: true, mode: 'force', assetDeleted: true }
	},
	{ matches: (path) => path.includes('/images'), response: imageRecord },
	{ matches: (path) => path.endsWith('/products/bulk'), response: { updatedCount: 1 } },
	{
		matches: (path) => path.endsWith('/password/reset'),
		response: { initialPassword: 'InitialPassword!1' }
	},
	{
		matches: (path, init) => path === '/api/management/staff' && init.method === 'POST',
		response: { staff: staffRecord, initialPassword: 'InitialPassword!1' }
	},
	{ matches: (path) => path.startsWith('/api/management/staff/'), response: staffRecord },
	{
		matches: (path) => path.startsWith('/api/management/orders/product-skus'),
		response: paginated([
			{ id: ids.sku, skuCode: 'SKU-1', productName: 'Glassware', price: 100, attributes: {} }
		])
	},
	{
		matches: (path) => path.startsWith('/api/management/orders'),
		response: orderRecord
	}
];

async function defaultApiResponse(path: string, init: RequestInit = {}) {
	const handler = defaultApiResponses.find((candidate) => candidate.matches(path, init));
	if (!handler) throw new Error(`Unexpected request: ${path}`);
	return handler.response;
}

beforeEach(() => {
	client.requestJson.mockReset();
	client.requestNoContent.mockReset();
	client.refreshSession.mockReset();
	client.clearCsrfToken.mockReset();
	client.requestJson.mockImplementation(defaultApiResponse);
	client.requestNoContent.mockResolvedValue(undefined);
});

describe('admin API security contracts', () => {
	it('loads security records and revives timestamp fields', async () => {
		client.requestJson
			.mockResolvedValueOnce({ data: [sessionRecord] })
			.mockResolvedValueOnce({ data: [passkeyRecord] });

		const result = await loadSecuritySettingsData();

		expect(result.sessions[0]?.authenticatedAt).toBeInstanceOf(Date);
		expect(result.sessions[0]?.expiresAt).toBeInstanceOf(Date);
		expect(result.passkeys[0]?.verifiedAt).toBeInstanceOf(Date);
		expect(client.requestJson.mock.calls.map(([path]) => path)).toEqual([
			'/api/auth/sessions',
			'/api/auth/passkeys'
		]);
	});

	it('rejects malformed successful API responses', async () => {
		client.requestJson
			.mockResolvedValueOnce({ data: [{ id: 'not-a-session' }] })
			.mockResolvedValueOnce({ data: [] });

		await expect(loadSecuritySettingsData()).rejects.toMatchObject({
			status: 502,
			code: 'INVALID_API_RESPONSE'
		});
	});

	it('maps an authentication 401 to an absent optional staff record', async () => {
		client.requestJson.mockRejectedValueOnce(
			new AdminApiError(401, 'Sign in required', 'AUTHENTICATION_REQUIRED')
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
	it('loads an editor with all category pages and product-owned deleted images', async () => {
		client.requestJson.mockImplementation(async (path: string) => {
			if (path.startsWith('/api/management/products/product-1?')) return productRecord;
			if (path.includes('/categories?') && path.includes('page=1')) {
				return {
					data: [categoryRecord],
					pagination: { page: 1, limit: 100, total: 2, totalPages: 2 }
				};
			}
			if (path.includes('/categories?') && path.includes('page=2')) {
				return {
					data: [
						{
							...categoryRecord,
							id: '00000000-0000-4000-8000-000000000011',
							name: 'Second',
							slug: 'second'
						}
					],
					pagination: { page: 2, limit: 100, total: 2, totalPages: 2 }
				};
			}
			if (path.includes('/images?state=deleted')) {
				return paginated([{ ...imageRecord, deletedAt: timestamp }]);
			}
			throw new Error(`Unexpected request: ${path}`);
		});

		const result = await loadProductEditorData('product-1');

		expect(result.product.createdAt).toBeInstanceOf(Date);
		expect(result.categories.map((category) => category.slug)).toEqual(['glassware', 'second']);
		expect(result.deletedImages[0]?.deletedAt).toBeInstanceOf(Date);
	});

	it('preserves SKU, image, and bulk product mutation contracts', async () => {
		await createProductSku({
			productId: 'product-1',
			skuCode: 'SKU-1',
			price: 100,
			stockQuantity: 8,
			attributes: { size: 'large' }
		});
		await updateProductSku('sku-1', { price: 120 });
		await deleteProductSku('sku-1');
		await createImageUploadTarget('product-1', {
			fileName: 'image.webp',
			contentType: 'image/webp',
			fileSize: 1024
		});
		await registerProductImage('product-1', {
			uploadId: 'upload-1',
			altText: 'Product',
			placement: 'shared-gallery'
		});
		await updateProductImageCrop('product-1', 'image-1', {
			focusX: 0.25,
			focusY: 0.75,
			zoom: 1.5
		});
		await deleteProductImage('product-1', 'image-1', { force: true, deleteAsset: true });
		await restoreProductImage('product-1', 'image-1');
		await bulkUpdateProducts({ productIds: ['product-1'], action: 'publish' });

		expect(client.requestJson).toHaveBeenCalledWith(
			'/api/management/products/product-1/images/image-1?force=true&deleteAsset=true',
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
			if (path === '/api/management/staff/roles') return [roleRecord];
			if (path.startsWith('/api/management/staff?')) {
				return {
					data: [staffRecord],
					pagination: { page: 2, limit: 20, total: 1, totalPages: 1 }
				};
			}
			throw new Error(`Unexpected request: ${path}`);
		});

		const result = await loadStaffPageData(new URLSearchParams({ page: '2', search: 'Ada' }));

		expect(result.roles).toEqual([roleRecord]);
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
		const idempotencyKey = crypto.randomUUID();

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
			idempotencyKey
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
				headers: { 'idempotency-key': idempotencyKey }
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
