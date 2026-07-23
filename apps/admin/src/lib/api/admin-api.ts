import {
	authFlowStateResponseSchema,
	authResultResponseSchema,
	categoryDeleteResponseSchema,
	categoryReorderResponseSchema,
	countResponseSchema,
	currentStaffEnvelopeResponseSchema,
	currentStaffResponseSchema,
	dashboardRangeResponseSchema,
	dashboardResponseSchema,
	dataResponseSchema,
	imageDeleteResponseSchema,
	imageUploadTargetResponseSchema,
	initialPasswordResponseSchema,
	managedAuthSessionResponseSchema,
	managedBusinessLabelResponseSchema,
	managedBusinessResponseSchema,
	managedCategoryDetailResponseSchema,
	managedCategoryResponseSchema,
	managedLogResponseSchema,
	managedOrderResponseSchema,
	managedOrderSkuLookupResponseSchema,
	managedPasskeyResponseSchema,
	managedProductImageResponseSchema,
	managedProductResponseSchema,
	managedProductSkuResponseSchema,
	managedRoleResponseSchema,
	managedStaffResponseSchema,
	mfaMethodSchema,
	orderStatusSchema,
	paginatedResponseSchema,
	paginationResponseSchema,
	passkeyOptionsResponseSchema,
	revokedCountResponseSchema,
	securityActionSchema,
	securityReauthMethodSchema,
	staffCreatedResponseSchema,
	staffStatusSchema,
	totpSetupResponseSchema,
	type ZodType,
	z
} from '@packages/schemas';

import { AdminApiError, adminApiClient } from './client';

export { AdminApiError } from './client';

export type MfaMethod = z.infer<typeof mfaMethodSchema>;
type OrderStatus = z.infer<typeof orderStatusSchema>;
type StaffStatus = z.infer<typeof staffStatusSchema>;

export type Pagination = z.infer<typeof paginationResponseSchema>;
export type ManagedRole = z.infer<typeof managedRoleResponseSchema>;
export type CurrentStaff = z.infer<typeof currentStaffResponseSchema>;
export type ManagedAuthSession = z.infer<typeof managedAuthSessionResponseSchema>;
export type ManagedPasskey = z.infer<typeof managedPasskeyResponseSchema>;
export type SecurityAction = z.infer<typeof securityActionSchema>;
export type SecurityReauthMethod = z.infer<typeof securityReauthMethodSchema>;
export type ManagedCategory = z.infer<typeof managedCategoryResponseSchema>;

export type CategoryDeleteInput = {
	productDisposition: 'reject' | 'uncategorize' | 'reassign';
	childDisposition: 'reject' | 'promote';
	reassignToCategoryId?: string;
};

export type CategoryDeleteResult = z.infer<typeof categoryDeleteResponseSchema>;
export type ManagedProductImage = z.infer<typeof managedProductImageResponseSchema>;
export type ManagedProductSku = z.infer<typeof managedProductSkuResponseSchema>;
export type ManagedProduct = z.infer<typeof managedProductResponseSchema>;
export type ManagedStaff = z.infer<typeof managedStaffResponseSchema>;
export type ManagedBusiness = z.infer<typeof managedBusinessResponseSchema>;
export type ManagedBusinessLabel = z.infer<typeof managedBusinessLabelResponseSchema>;
export type ManagedOrder = z.infer<typeof managedOrderResponseSchema>;
export type ManagedOrderItem = ManagedOrder['items'][number];
export type ManagedOrderSkuLookup = z.infer<typeof managedOrderSkuLookupResponseSchema>;
export type ManagedLog = z.infer<typeof managedLogResponseSchema>;
export type DashboardRange = z.infer<typeof dashboardRangeResponseSchema>;
export type DashboardData = z.infer<typeof dashboardResponseSchema>;
export type DashboardMetric = DashboardData['metrics'][number];
export type DashboardTrendSeries = DashboardData['trend']['series'][number];
export type DashboardTrendPoint = DashboardTrendSeries['points'][number];
export type AuthFlowState = z.infer<typeof authFlowStateResponseSchema>;

type AuthResult = z.infer<typeof authResultResponseSchema>;
type PasskeyOptions = z.infer<typeof passkeyOptionsResponseSchema>;
type TotpSetup = z.infer<typeof totpSetupResponseSchema>;

const pageSize = 100;
const managementPageSize = 20;

type JsonRequestOptions = {
	authenticated?: boolean;
	retryOnUnauthorized?: boolean;
};

async function json<T>(
	path: string,
	schema: ZodType<T>,
	init: RequestInit = {},
	options: JsonRequestOptions = {}
): Promise<T> {
	const payload = await adminApiClient.requestJson<unknown>(path, init, options);
	const result = schema.safeParse(payload);
	if (!result.success) {
		throw new AdminApiError(
			502,
			'管理 API 回傳了無效的資料格式。',
			'INVALID_API_RESPONSE',
			result.error.issues
		);
	}
	return result.data;
}

function body(method: string, value: unknown): RequestInit {
	return { method, body: JSON.stringify(value) };
}

async function collectPaginatedData<T>(
	pathname: string,
	itemSchema: ZodType<T>,
	searchParams: URLSearchParams = new URLSearchParams()
): Promise<T[]> {
	const data: T[] = [];
	const responseSchema = paginatedResponseSchema(itemSchema);
	for (let page = 1; ; page += 1) {
		const params = new URLSearchParams(searchParams);
		params.set('page', String(page));
		params.set('limit', String(pageSize));
		const response = await json(`${pathname}?${params}`, responseSchema);
		data.push(...response.data);
		if (page >= response.pagination.totalPages || response.pagination.totalPages === 0) break;
	}
	return data;
}

async function loadPaginatedData<T>(
	pathname: string,
	itemSchema: ZodType<T>,
	searchParams: URLSearchParams
) {
	const params = new URLSearchParams(searchParams);
	params.set('page', params.get('page') ?? '1');
	params.set('limit', String(managementPageSize));
	return json(`${pathname}?${params}`, paginatedResponseSchema(itemSchema));
}

export function formatDate(value: Date | null): string {
	if (!value) return '尚無資料';
	return new Intl.DateTimeFormat('zh-TW', {
		dateStyle: 'medium',
		timeZone: 'Asia/Taipei'
	}).format(value);
}

export function formatDateTime(value: Date): string {
	return new Intl.DateTimeFormat('zh-TW', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Asia/Taipei'
	}).format(value);
}

export async function getAuthState(): Promise<AuthFlowState> {
	return json(
		'/api/auth/state',
		authFlowStateResponseSchema,
		{},
		{
			authenticated: false,
			retryOnUnauthorized: false
		}
	);
}

export function refreshCurrentSession(): Promise<boolean> {
	return adminApiClient.refreshSession();
}

export async function getOptionalCurrentStaff() {
	try {
		return await json('/api/auth/me', currentStaffEnvelopeResponseSchema);
	} catch (error) {
		if (error instanceof AdminApiError && error.status === 401) return null;
		throw error;
	}
}

export async function loadSecuritySettingsData() {
	const [sessions, passkeys] = await Promise.all([
		json('/api/auth/sessions', dataResponseSchema(managedAuthSessionResponseSchema)),
		json('/api/auth/passkeys', dataResponseSchema(managedPasskeyResponseSchema))
	]);
	return { sessions: sessions.data, passkeys: passkeys.data };
}

export function revokeAuthSession(sessionId: string) {
	return adminApiClient.requestNoContent(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' });
}

export function revokeOtherAuthSessions() {
	return json('/api/auth/sessions/revoke-others', revokedCountResponseSchema, body('POST', {}));
}

export function changeCurrentPassword(input: { currentPassword: string; newPassword: string }) {
	return json('/api/auth/password', authResultResponseSchema, body('PATCH', input));
}

export function updateMfaPreference(input: { preferredMfaMethod: MfaMethod }) {
	return adminApiClient.requestNoContent('/api/auth/mfa-preference', body('PATCH', input));
}

export function verifySecurityPassword(input: {
	action: SecurityAction;
	targetId?: string | null;
	password: string;
}) {
	return adminApiClient.requestNoContent('/api/auth/security/reauth/password', body('POST', input));
}

export function verifySecurityTotp(input: {
	action: SecurityAction;
	targetId?: string | null;
	code: string;
}) {
	return adminApiClient.requestNoContent('/api/auth/security/reauth/totp', body('POST', input));
}

export function beginSecurityPasskeyReauth(input: {
	action: SecurityAction;
	targetId?: string | null;
}): Promise<PasskeyOptions> {
	return json(
		'/api/auth/security/reauth/passkey/options',
		passkeyOptionsResponseSchema,
		body('POST', input)
	);
}

export function completeSecurityPasskeyReauth(credential: unknown) {
	return adminApiClient.requestNoContent(
		'/api/auth/security/reauth/passkey/verify',
		body('POST', { credential })
	);
}

export function beginSecurityTotpSetup(): Promise<TotpSetup> {
	return json('/api/auth/mfa/totp/setup', totpSetupResponseSchema, body('POST', {}));
}

export function completeSecurityTotpSetup(code: string) {
	return adminApiClient.requestNoContent('/api/auth/mfa/totp/confirm', body('POST', { code }));
}

export function removeSecurityTotp() {
	return adminApiClient.requestNoContent('/api/auth/mfa/totp', { method: 'DELETE' });
}

export function beginManagedPasskeyRegistration(nickname: string): Promise<PasskeyOptions> {
	return json(
		'/api/auth/passkeys/registration/options',
		passkeyOptionsResponseSchema,
		body('POST', { nickname })
	);
}

export function completeManagedPasskeyRegistration(credential: unknown) {
	return json(
		'/api/auth/passkeys/registration/verify',
		managedPasskeyResponseSchema,
		body('POST', { credential })
	);
}

export function renameManagedPasskey(passkeyId: string, nickname: string) {
	return json(
		`/api/auth/passkeys/${passkeyId}`,
		managedPasskeyResponseSchema,
		body('PATCH', { nickname })
	);
}

export function removeManagedPasskey(passkeyId: string) {
	return adminApiClient.requestNoContent(`/api/auth/passkeys/${passkeyId}`, {
		method: 'DELETE'
	});
}

const unauthenticatedRequest = {
	authenticated: false,
	retryOnUnauthorized: false
} as const;

export function loginWithPassword(input: { email: string; password: string }): Promise<AuthResult> {
	return json(
		'/api/auth/login/password',
		authResultResponseSchema,
		body('POST', input),
		unauthenticatedRequest
	);
}

export async function beginPasskeyLogin(): Promise<PasskeyOptions> {
	return json(
		'/api/auth/login/passkey/options',
		passkeyOptionsResponseSchema,
		body('POST', {}),
		unauthenticatedRequest
	);
}

export function completePasskeyLogin(credential: unknown): Promise<AuthResult> {
	return json(
		'/api/auth/login/passkey/verify',
		authResultResponseSchema,
		body('POST', { credential }),
		unauthenticatedRequest
	);
}

export function completeTotpLogin(code: string): Promise<AuthResult> {
	return json(
		'/api/auth/login/mfa/totp',
		authResultResponseSchema,
		body('POST', { code }),
		unauthenticatedRequest
	);
}

export function beginPasskeyMfa(): Promise<PasskeyOptions> {
	return json(
		'/api/auth/login/mfa/passkey/options',
		passkeyOptionsResponseSchema,
		body('POST', {}),
		unauthenticatedRequest
	);
}

export function completePasskeyMfa(credential: unknown): Promise<AuthResult> {
	return json(
		'/api/auth/login/mfa/passkey/verify',
		authResultResponseSchema,
		body('POST', { credential }),
		unauthenticatedRequest
	);
}

export async function beginTotpMfaSetup(): Promise<TotpSetup> {
	return json(
		'/api/auth/login/setup/totp/options',
		totpSetupResponseSchema,
		body('POST', {}),
		unauthenticatedRequest
	);
}

export function completeTotpMfaSetup(code: string): Promise<AuthResult> {
	return json(
		'/api/auth/login/setup/totp/confirm',
		authResultResponseSchema,
		body('POST', { code }),
		unauthenticatedRequest
	);
}

export function beginPasskeyMfaSetup(nickname?: string): Promise<PasskeyOptions> {
	return json(
		'/api/auth/login/setup/passkey/options',
		passkeyOptionsResponseSchema,
		body('POST', { nickname }),
		unauthenticatedRequest
	);
}

export function completePasskeyMfaSetup(credential: unknown): Promise<AuthResult> {
	return json(
		'/api/auth/login/setup/passkey/verify',
		authResultResponseSchema,
		body('POST', { credential }),
		unauthenticatedRequest
	);
}

export async function logoutCurrentSession(): Promise<void> {
	try {
		await adminApiClient.requestNoContent('/api/auth/logout', body('POST', {}), {
			authenticated: false,
			retryOnUnauthorized: false
		});
	} finally {
		adminApiClient.clearCsrfToken();
	}
}

export function loadDashboardData(range: DashboardRange = 'days'): Promise<DashboardData> {
	return json(`/api/management/dashboard?range=${range}`, dashboardResponseSchema);
}

export async function loadProductPageData(searchParams = new URLSearchParams()) {
	const [categories, products] = await Promise.all([
		collectPaginatedData('/api/management/products/categories', managedCategoryResponseSchema),
		loadPaginatedData('/api/management/products', managedProductResponseSchema, searchParams)
	]);
	return { categories, products: products.data, pagination: products.pagination };
}

export async function loadCategoryPageData() {
	const categories = await collectPaginatedData(
		'/api/management/products/categories',
		managedCategoryResponseSchema
	);
	return { categories };
}

export function loadCategoryDetail(categoryId: string) {
	return json(
		`/api/management/products/categories/${categoryId}?includeChildren=true&includeProductCount=true`,
		managedCategoryDetailResponseSchema
	);
}

export function createCategory(input: {
	name: string;
	nameEn?: string;
	slug: string;
	parentId?: string;
	description?: string;
	descriptionEn?: string;
	position: number;
}) {
	return json(
		'/api/management/products/categories',
		managedCategoryResponseSchema,
		body('POST', input)
	);
}

export function updateCategory(
	categoryId: string,
	input: {
		name?: string;
		nameEn?: string | null;
		slug?: string;
		parentId?: string | null;
		description?: string | null;
		descriptionEn?: string | null;
		position?: number;
	}
) {
	return json(
		`/api/management/products/categories/${categoryId}`,
		managedCategoryResponseSchema,
		body('PATCH', input)
	);
}

export function reorderCategories(input: { parentId: string | null; categoryIds: string[] }) {
	return json(
		'/api/management/products/categories/reorder',
		categoryReorderResponseSchema,
		body('PUT', input)
	);
}

export function deleteCategory(categoryId: string, input: CategoryDeleteInput) {
	const params = new URLSearchParams({
		productDisposition: input.productDisposition,
		childDisposition: input.childDisposition
	});
	if (input.reassignToCategoryId) {
		params.set('reassignToCategoryId', input.reassignToCategoryId);
	}
	return json(
		`/api/management/products/categories/${categoryId}?${params}`,
		categoryDeleteResponseSchema,
		{ method: 'DELETE' }
	);
}

export async function loadProductEditorData(productId: string) {
	const [product, categories] = await Promise.all([
		json(
			`/api/management/products/${productId}?includeSkus=true&includeImages=true`,
			managedProductResponseSchema
		),
		collectPaginatedData('/api/management/products/categories', managedCategoryResponseSchema)
	]);
	const deletedImages = await json(
		`/api/management/products/${productId}/images?state=deleted&page=1&limit=${pageSize}`,
		paginatedResponseSchema(managedProductImageResponseSchema)
	);
	return { product, categories, deletedImages: deletedImages.data };
}

export function createProduct(input: {
	slug: string;
	name: string;
	nameEn?: string;
	description?: string;
	descriptionEn?: string;
	categoryId?: string | null;
	published: boolean;
}) {
	return json('/api/management/products', managedProductResponseSchema, body('POST', input));
}

export function updateProduct(productId: string, input: Partial<Omit<ManagedProduct, 'id'>>) {
	return json(
		`/api/management/products/${productId}`,
		managedProductResponseSchema,
		body('PATCH', input)
	);
}

export function deleteProduct(productId: string) {
	return adminApiClient.requestNoContent(`/api/management/products/${productId}`, {
		method: 'DELETE'
	});
}

export function restoreProduct(productId: string) {
	return json(
		`/api/management/products/${productId}/restore`,
		managedProductResponseSchema,
		body('POST', {})
	);
}

export function createProductSku(input: {
	productId: string;
	skuCode: string;
	price: number;
	stockQuantity: number;
	attributes: Record<string, unknown>;
}) {
	return json(
		'/api/management/products/skus',
		managedProductSkuResponseSchema,
		body('POST', input)
	);
}

export function updateProductSku(
	skuId: string,
	input: {
		skuCode?: string;
		price?: number;
		stockQuantity?: number;
		attributes?: Record<string, unknown>;
	}
) {
	return json(
		`/api/management/products/skus/${skuId}`,
		managedProductSkuResponseSchema,
		body('PATCH', input)
	);
}

export function deleteProductSku(skuId: string) {
	return adminApiClient.requestNoContent(`/api/management/products/skus/${skuId}`, {
		method: 'DELETE'
	});
}

export function createImageUploadTarget(
	productId: string,
	input: { fileName: string; contentType: string; fileSize: number }
) {
	return json(
		`/api/management/products/${productId}/images/upload-url`,
		imageUploadTargetResponseSchema,
		body('POST', input)
	);
}

export function registerProductImage(
	productId: string,
	input: {
		uploadId: string;
		skuId?: string | null;
		altText: string;
		placement: 'thumbnail' | 'shared-gallery' | 'sku-gallery';
		focusX?: number | null;
		focusY?: number | null;
		zoom?: number | null;
	}
) {
	return json(
		`/api/management/products/${productId}/images`,
		managedProductImageResponseSchema,
		body('POST', input)
	);
}

export function updateProductImageCrop(
	productId: string,
	imageId: string,
	input: { focusX: number; focusY: number; zoom: number }
) {
	return json(
		`/api/management/products/${productId}/images/${imageId}/crop`,
		managedProductImageResponseSchema,
		body('PATCH', input)
	);
}

export function deleteProductImage(
	productId: string,
	imageId: string,
	options: { force?: boolean; deleteAsset?: boolean } = {}
) {
	const params = new URLSearchParams();
	if (options.force) params.set('force', 'true');
	if (options.deleteAsset) params.set('deleteAsset', 'true');
	return json(
		`/api/management/products/${productId}/images/${imageId}${params.size ? `?${params}` : ''}`,
		imageDeleteResponseSchema,
		{ method: 'DELETE' }
	);
}

export function restoreProductImage(productId: string, imageId: string) {
	return json(
		`/api/management/products/${productId}/images/${imageId}/restore`,
		managedProductImageResponseSchema,
		body('POST', {})
	);
}

export async function loadStaffPageData(searchParams = new URLSearchParams()) {
	const [roles, staff] = await Promise.all([
		json('/api/management/staff/roles', z.array(managedRoleResponseSchema)),
		loadPaginatedData('/api/management/staff', managedStaffResponseSchema, searchParams)
	]);
	return { roles, staff: staff.data, pagination: staff.pagination };
}

export function createStaff(input: { email: string; name: string; roleIds: string[] }) {
	return json('/api/management/staff', staffCreatedResponseSchema, body('POST', input));
}

export function updateStaff(
	staffId: string,
	input: { email?: string; name?: string; roleIds?: string[]; status?: StaffStatus }
) {
	return json(`/api/management/staff/${staffId}`, managedStaffResponseSchema, body('PATCH', input));
}

export function deleteStaff(staffId: string) {
	return adminApiClient.requestNoContent(`/api/management/staff/${staffId}`, {
		method: 'DELETE'
	});
}

export function restoreStaff(staffId: string) {
	return json(
		`/api/management/staff/${staffId}/restore`,
		managedStaffResponseSchema,
		body('POST', {})
	);
}

export function resetStaffMfa(staffId: string) {
	return adminApiClient.requestNoContent(`/api/management/staff/${staffId}/mfa/reset`, {
		method: 'POST',
		body: '{}'
	});
}

export function resetStaffPassword(staffId: string) {
	return json(
		`/api/management/staff/${staffId}/password/reset`,
		initialPasswordResponseSchema,
		body('POST', {})
	);
}

export async function loadBusinessPageData(
	searchParams = new URLSearchParams({ includeDeleted: 'true' })
) {
	const [businesses, labels] = await Promise.all([
		loadPaginatedData('/api/management/businesses', managedBusinessResponseSchema, searchParams),
		collectPaginatedData(
			'/api/management/businesses/labels',
			managedBusinessLabelResponseSchema,
			new URLSearchParams({ includeDeleted: 'true' })
		)
	]);
	return { businesses: businesses.data, pagination: businesses.pagination, labels };
}

export function createBusiness(input: {
	name: string;
	contactName?: string;
	contactEmail?: string;
	contactPhone?: string;
	taxId?: string;
	address?: string;
	notes?: string;
	labelId?: string | null;
}) {
	return json('/api/management/businesses', managedBusinessResponseSchema, body('POST', input));
}

export function updateBusiness(businessId: string, input: Partial<ManagedBusiness>) {
	return json(
		`/api/management/businesses/${businessId}`,
		managedBusinessResponseSchema,
		body('PATCH', input)
	);
}

export function deleteBusiness(businessId: string) {
	return adminApiClient.requestNoContent(`/api/management/businesses/${businessId}`, {
		method: 'DELETE'
	});
}

export function restoreBusiness(businessId: string) {
	return json(
		`/api/management/businesses/${businessId}/restore`,
		managedBusinessResponseSchema,
		body('POST', {})
	);
}

export function bulkUpdateBusinessLabel(input: { businessIds: string[]; labelId: string | null }) {
	return json('/api/management/businesses/bulk-label', countResponseSchema, body('PATCH', input));
}

export function createBusinessLabel(input: {
	name: string;
	color: string;
	discountRate?: number | null;
}) {
	return json(
		'/api/management/businesses/labels',
		managedBusinessLabelResponseSchema,
		body('POST', input)
	);
}

export function updateBusinessLabel(
	labelId: string,
	input: Partial<{ name: string; color: string; discountRate: number | null }>
) {
	return json(
		`/api/management/businesses/labels/${labelId}`,
		managedBusinessLabelResponseSchema,
		body('PATCH', input)
	);
}

export function deleteBusinessLabel(labelId: string) {
	return adminApiClient.requestNoContent(`/api/management/businesses/labels/${labelId}`, {
		method: 'DELETE'
	});
}

export function restoreBusinessLabel(labelId: string) {
	return json(
		`/api/management/businesses/labels/${labelId}/restore`,
		managedBusinessLabelResponseSchema,
		body('POST', {})
	);
}

export async function loadOrderPageData(searchParams = new URLSearchParams()) {
	const [businesses, orders] = await Promise.all([
		collectPaginatedData('/api/management/businesses', managedBusinessResponseSchema),
		loadPaginatedData('/api/management/orders', managedOrderResponseSchema, searchParams)
	]);
	return { businesses, orders: orders.data, pagination: orders.pagination };
}

export async function loadOrderSkuLookups(search = '') {
	const params = new URLSearchParams();
	if (search.trim()) params.set('search', search.trim());
	params.set('page', '1');
	params.set('limit', String(managementPageSize));
	return json(
		`/api/management/orders/product-skus?${params}`,
		paginatedResponseSchema(managedOrderSkuLookupResponseSchema)
	);
}

export type OrderInput = {
	businessId?: string | null;
	customerName?: string | null;
	customerEmail?: string | null;
	customerPhone?: string | null;
	customerAddress?: string | null;
	discountRate?: number;
	items: Array<{
		productSkuId?: string;
		skuCode: string;
		productName: string;
		unitPrice: number;
		quantity: number;
		attributes: Record<string, unknown>;
	}>;
};

export function createOrder(
	input: OrderInput,
	idempotencyKey: string = globalThis.crypto.randomUUID()
) {
	return json('/api/management/orders', managedOrderResponseSchema, {
		...body('POST', input),
		headers: { 'idempotency-key': idempotencyKey }
	});
}

export function bulkUpdateProducts(input: {
	productIds: string[];
	action: 'archive' | 'restore' | 'publish' | 'unpublish';
}) {
	return json('/api/management/products/bulk', countResponseSchema, body('PATCH', input));
}

export function updateOrderStatus(orderId: string, status: OrderStatus) {
	return json(
		`/api/management/orders/${orderId}/status`,
		managedOrderResponseSchema,
		body('PATCH', { status })
	);
}

export function updateOrder(
	orderId: string,
	input: Omit<OrderInput, 'items'> & { status: OrderStatus }
) {
	return json(
		`/api/management/orders/${orderId}`,
		managedOrderResponseSchema,
		body('PATCH', input)
	);
}

export function loadLogsPageData(searchParams = new URLSearchParams()) {
	return loadPaginatedData('/api/management/logs', managedLogResponseSchema, searchParams);
}

export function loadLogDetail(logId: string) {
	return json(`/api/management/logs/${logId}`, managedLogResponseSchema);
}
