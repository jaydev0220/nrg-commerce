import {
	logKindSchema,
	logLevelSchema,
	mfaMethodSchema,
	orderStatusSchema,
	permissionKeySchema,
	roleKeySchema,
	staffStatusSchema,
	type z
} from '@packages/schemas';

import { AdminApiError, adminApiClient } from './client';

export { AdminApiError } from './client';

type LogKind = z.infer<typeof logKindSchema>;
type LogLevel = z.infer<typeof logLevelSchema>;
export type MfaMethod = z.infer<typeof mfaMethodSchema>;
type OrderStatus = z.infer<typeof orderStatusSchema>;
type PermissionKey = z.infer<typeof permissionKeySchema>;
type RoleKey = z.infer<typeof roleKeySchema>;
type StaffStatus = z.infer<typeof staffStatusSchema>;

export type Pagination = {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
};

export type ManagedRole = {
	id: string;
	key: RoleKey;
	name: string;
	permissions: PermissionKey[];
};

export type CurrentStaff = {
	id: string;
	email: string;
	name: string;
	status: StaffStatus;
	preferredMfaMethod: MfaMethod | null;
	lastLoginAt: Date | null;
	roles: ManagedRole[];
	totpCredentialCount: number;
	passkeyCredentialCount: number;
};

export type ManagedAuthSession = {
	id: string;
	staffId: string;
	userAgent: string | null;
	ipAddress: string | null;
	authenticatedAt: Date;
	lastSeenAt: Date | null;
	expiresAt: Date;
	revokedAt: Date | null;
};

export type ManagedPasskey = {
	id: string;
	nickname: string | null;
	deviceType: 'singleDevice' | 'multiDevice' | null;
	backedUp: boolean | null;
	verifiedAt: Date | null;
	lastUsedAt: Date | null;
};

export type SecurityAction =
	| 'add_totp'
	| 'remove_totp'
	| 'add_passkey'
	| 'rename_passkey'
	| 'remove_passkey';

export type SecurityReauthMethod = 'password' | 'authenticator' | 'passkey';

export type ManagedCategory = {
	id: string;
	name: string;
	nameEn: string | null;
	slug: string;
	description: string | null;
	descriptionEn: string | null;
	position: number;
	parentId: string | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	productCount?: number;
};

export type CategoryDeleteInput = {
	productDisposition: 'reject' | 'uncategorize' | 'reassign';
	childDisposition: 'reject' | 'promote';
	reassignToCategoryId?: string;
};

export type CategoryDeleteResult = {
	deleted: true;
	mode: 'soft';
	productDisposition: 'none' | 'uncategorize' | 'reassign';
	childDisposition: 'none' | 'promote';
};

export type ManagedProductImage = {
	id: string;
	skuId: string;
	imageUrl: string;
	assetKey: string | null;
	altText: string;
	type: 'thumbnail' | 'gallery';
	position: number;
	focusX: number | null;
	focusY: number | null;
	zoom: number | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

export type ManagedProductSku = {
	id: string;
	productId: string;
	productSlug: string;
	skuCode: string;
	name: string;
	nameEn: string | null;
	description: string | null;
	descriptionEn: string | null;
	categoryId: string | null;
	categorySlug: string | null;
	price: number;
	published: boolean;
	attributes: Record<string, unknown>;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	images: ManagedProductImage[];
};

export type ManagedProduct = {
	id: string;
	slug: string;
	name: string;
	nameEn: string | null;
	description: string | null;
	descriptionEn: string | null;
	categoryId: string | null;
	categorySlug: string | null;
	published: boolean;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	skus: ManagedProductSku[];
};

export type ManagedStaff = {
	id: string;
	email: string;
	name: string;
	status: StaffStatus;
	preferredMfaMethod: MfaMethod | null;
	lastLoginAt: Date | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	roles: ManagedRole[];
};

export type ManagedBusiness = {
	id: string;
	name: string;
	contactName: string | null;
	contactEmail: string | null;
	contactPhone: string | null;
	taxId: string | null;
	address: string | null;
	notes: string | null;
	labelId: string | null;
	label: ManagedBusinessLabel | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

export type ManagedBusinessLabel = {
	id: string;
	name: string;
	color: string;
	discountRate: number | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

export type ManagedOrderItem = {
	id: string;
	orderId: string;
	productSkuId: string | null;
	skuCode: string;
	productName: string;
	unitPrice: number;
	quantity: number;
	lineTotal: number;
	attributes: Record<string, unknown>;
	createdAt: Date;
};

export type ManagedOrderSkuLookup = {
	id: string;
	skuCode: string;
	productName: string;
	price: number;
	attributes: Record<string, unknown>;
};

export type ManagedOrder = {
	id: string;
	businessId: string | null;
	status: OrderStatus;
	customerName: string | null;
	customerEmail: string | null;
	customerPhone: string | null;
	customerAddress: string | null;
	itemCount: number;
	subtotalAmount: number;
	discountLabelId: string | null;
	discountLabelName: string | null;
	suggestedDiscountRate: number | null;
	discountRate: number;
	discountAmount: number;
	totalAmount: number;
	completedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	business: ManagedBusiness | null;
	items: ManagedOrderItem[];
};

export type ManagedLog = {
	id: string;
	level: LogLevel;
	kind: LogKind;
	message: string;
	actorStaffId: string | null;
	requestId: string | null;
	method: string | null;
	path: string | null;
	statusCode: number | null;
	entityType: string | null;
	entityId: string | null;
	metadata: unknown;
	expiresAt: Date;
	createdAt: Date;
};

export type DashboardRange = 'days' | 'months' | 'quarters';

export type DashboardMetric = {
	key: 'completedSales' | 'completedOrders' | 'businessSalesShare';
	value: number;
	comparison: number;
	comparisonKind: 'percent' | 'percentagePoint';
	reference: 'previousMonth';
};

export type DashboardTrendPoint = {
	startAt: Date;
	label: string;
	value: number;
};

export type DashboardTrendSeries = {
	key: 'total' | 'business' | 'consumer';
	points: DashboardTrendPoint[];
};

export type DashboardData = {
	metrics: DashboardMetric[];
	trend: {
		range: DashboardRange;
		series: DashboardTrendSeries[];
	};
	topProducts: Array<{ name: string; value: number; share: number }>;
};

export type AuthFlowState =
	| { status: 'unauthenticated' }
	| { status: 'authenticated' }
	| { status: 'refresh_required' }
	| { status: 'mfa_required'; method: MfaMethod; availableMethods: readonly MfaMethod[] }
	| { status: 'mfa_setup_required'; availableMethods: readonly MfaMethod[] };

type PaginatedResponse<T> = { data: T[]; pagination: Pagination };
type AuthResult = Exclude<AuthFlowState, { status: 'unauthenticated' | 'refresh_required' }>;
type PasskeyOptions = { options: unknown };
type TotpSetup = {
	secret: string;
	otpauthUrl: string;
	digits: number;
	period: number;
};

const pageSize = 100;
const managementPageSize = 20;

function reviveDates(value: unknown, key = ''): unknown {
	if (typeof value === 'string' && key.endsWith('At')) return new Date(value);
	if (Array.isArray(value)) return value.map((item) => reviveDates(item));
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([entryKey, entryValue]) => [
				entryKey,
				reviveDates(entryValue, entryKey)
			])
		);
	}
	return value;
}

async function json<T>(
	path: string,
	init: RequestInit = {},
	options: { authenticated?: boolean; retryOnUnauthorized?: boolean } = {}
): Promise<T> {
	return reviveDates(await adminApiClient.requestJson<T>(path, init, options)) as T;
}

function body(method: string, value: unknown): RequestInit {
	return { method, body: JSON.stringify(value) };
}

async function collectPaginatedData<T>(
	pathname: string,
	searchParams: URLSearchParams = new URLSearchParams()
): Promise<T[]> {
	const data: T[] = [];
	for (let page = 1; ; page += 1) {
		const params = new URLSearchParams(searchParams);
		params.set('page', String(page));
		params.set('limit', String(pageSize));
		const response = await json<PaginatedResponse<T>>(`${pathname}?${params}`);
		data.push(...response.data);
		if (page >= response.pagination.totalPages || response.pagination.totalPages === 0) break;
	}
	return data;
}

async function loadPaginatedData<T>(pathname: string, searchParams: URLSearchParams) {
	const params = new URLSearchParams(searchParams);
	params.set('page', params.get('page') ?? '1');
	params.set('limit', String(managementPageSize));
	return json<PaginatedResponse<T>>(`${pathname}?${params}`);
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
	return json('/api/auth/state', {}, { authenticated: false, retryOnUnauthorized: false });
}

export function refreshCurrentSession(): Promise<boolean> {
	return adminApiClient.refreshSession();
}

export async function getOptionalCurrentStaff() {
	try {
		return await json<{ staff: CurrentStaff; sessionId: string; mfaMethods: MfaMethod[] }>(
			'/api/auth/me'
		);
	} catch (error) {
		if (error instanceof AdminApiError && error.status === 401) return null;
		throw error;
	}
}

export async function loadSecuritySettingsData() {
	const [sessions, passkeys] = await Promise.all([
		json<{ data: ManagedAuthSession[] }>('/api/auth/sessions'),
		json<{ data: ManagedPasskey[] }>('/api/auth/passkeys')
	]);
	return { sessions: sessions.data, passkeys: passkeys.data };
}

export function revokeAuthSession(sessionId: string) {
	return adminApiClient.requestNoContent(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' });
}

export function revokeOtherAuthSessions() {
	return json<{ revokedCount: number }>('/api/auth/sessions/revoke-others', body('POST', {}));
}

export function changeCurrentPassword(input: { currentPassword: string; newPassword: string }) {
	return json('/api/auth/password', body('PATCH', input));
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
	return json('/api/auth/security/reauth/passkey/options', body('POST', input));
}

export function completeSecurityPasskeyReauth(credential: unknown) {
	return adminApiClient.requestNoContent(
		'/api/auth/security/reauth/passkey/verify',
		body('POST', { credential })
	);
}

export function beginSecurityTotpSetup(): Promise<TotpSetup> {
	return json('/api/auth/mfa/totp/setup', body('POST', {}));
}

export function completeSecurityTotpSetup(code: string) {
	return adminApiClient.requestNoContent('/api/auth/mfa/totp/confirm', body('POST', { code }));
}

export function removeSecurityTotp() {
	return adminApiClient.requestNoContent('/api/auth/mfa/totp', { method: 'DELETE' });
}

export function beginManagedPasskeyRegistration(nickname: string): Promise<PasskeyOptions> {
	return json('/api/auth/passkeys/registration/options', body('POST', { nickname }));
}

export function completeManagedPasskeyRegistration(credential: unknown) {
	return json('/api/auth/passkeys/registration/verify', body('POST', { credential }));
}

export function renameManagedPasskey(passkeyId: string, nickname: string) {
	return json<ManagedPasskey>(`/api/auth/passkeys/${passkeyId}`, body('PATCH', { nickname }));
}

export function removeManagedPasskey(passkeyId: string) {
	return adminApiClient.requestNoContent(`/api/auth/passkeys/${passkeyId}`, { method: 'DELETE' });
}

export function loginWithPassword(input: { email: string; password: string }): Promise<AuthResult> {
	return json('/api/auth/login/password', body('POST', input), {
		authenticated: false,
		retryOnUnauthorized: false
	});
}

export async function beginPasskeyLogin(email?: string): Promise<PasskeyOptions> {
	return json('/api/auth/login/passkey/options', body('POST', email ? { email } : {}), {
		authenticated: false,
		retryOnUnauthorized: false
	});
}

export function completePasskeyLogin(credential: unknown): Promise<AuthResult> {
	return json('/api/auth/login/passkey/verify', body('POST', { credential }), {
		authenticated: false,
		retryOnUnauthorized: false
	});
}

export function completeTotpLogin(code: string): Promise<AuthResult> {
	return json('/api/auth/login/mfa/totp', body('POST', { code }), {
		authenticated: false,
		retryOnUnauthorized: false
	});
}

export function beginPasskeyMfa(): Promise<PasskeyOptions> {
	return json('/api/auth/login/mfa/passkey/options', body('POST', {}), {
		authenticated: false,
		retryOnUnauthorized: false
	});
}

export function completePasskeyMfa(credential: unknown): Promise<AuthResult> {
	return json('/api/auth/login/mfa/passkey/verify', body('POST', { credential }), {
		authenticated: false,
		retryOnUnauthorized: false
	});
}

export async function beginTotpMfaSetup(): Promise<TotpSetup> {
	return json('/api/auth/login/setup/totp/options', body('POST', {}), {
		authenticated: false,
		retryOnUnauthorized: false
	});
}

export function completeTotpMfaSetup(code: string): Promise<AuthResult> {
	return json('/api/auth/login/setup/totp/confirm', body('POST', { code }), {
		authenticated: false,
		retryOnUnauthorized: false
	});
}

export function beginPasskeyMfaSetup(nickname?: string): Promise<PasskeyOptions> {
	return json('/api/auth/login/setup/passkey/options', body('POST', { nickname }), {
		authenticated: false,
		retryOnUnauthorized: false
	});
}

export function completePasskeyMfaSetup(credential: unknown): Promise<AuthResult> {
	return json('/api/auth/login/setup/passkey/verify', body('POST', { credential }), {
		authenticated: false,
		retryOnUnauthorized: false
	});
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
	return json(`/api/management/dashboard?range=${range}`);
}

export async function loadProductPageData(searchParams = new URLSearchParams()) {
	const [categories, products] = await Promise.all([
		collectPaginatedData<ManagedCategory>('/api/management/products/categories'),
		loadPaginatedData<ManagedProduct>('/api/management/products', searchParams)
	]);
	return { categories, products: products.data, pagination: products.pagination };
}

export async function loadCategoryPageData() {
	const categories = await collectPaginatedData<ManagedCategory>(
		'/api/management/products/categories'
	);
	return { categories };
}

export function loadCategoryDetail(categoryId: string) {
	return json<ManagedCategory & { children?: ManagedCategory[] }>(
		`/api/management/products/categories/${categoryId}?includeChildren=true&includeProductCount=true`
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
	return json<ManagedCategory>('/api/management/products/categories', body('POST', input));
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
	return json<ManagedCategory>(
		`/api/management/products/categories/${categoryId}`,
		body('PATCH', input)
	);
}

export function reorderCategories(input: { parentId: string | null; categoryIds: string[] }) {
	return json<{ reordered: true }>(
		'/api/management/products/categories/reorder',
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
	return json<CategoryDeleteResult>(`/api/management/products/categories/${categoryId}?${params}`, {
		method: 'DELETE'
	});
}

export async function loadProductEditorData(productId: string) {
	const [product, categories] = await Promise.all([
		json<ManagedProduct>(
			`/api/management/products/${productId}?includeSkus=true&includeImages=true`
		),
		collectPaginatedData<ManagedCategory>('/api/management/products/categories')
	]);
	const deletedImages = Object.fromEntries(
		await Promise.all(
			product.skus.map(async (sku) => {
				const result = await json<PaginatedResponse<ManagedProductImage>>(
					`/api/management/products/skus/${sku.id}/images?state=deleted&page=1&limit=${pageSize}`
				);
				return [sku.id, result.data] as const;
			})
		)
	);
	return { product, categories, deletedImages };
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
	return json<ManagedProduct>('/api/management/products', body('POST', input));
}

export function updateProduct(productId: string, input: Partial<Omit<ManagedProduct, 'id'>>) {
	return json<ManagedProduct>(`/api/management/products/${productId}`, body('PATCH', input));
}

export function deleteProduct(productId: string) {
	return adminApiClient.requestNoContent(`/api/management/products/${productId}`, {
		method: 'DELETE'
	});
}

export function restoreProduct(productId: string) {
	return json<ManagedProduct>(`/api/management/products/${productId}/restore`, body('POST', {}));
}

export function createProductSku(input: {
	productId: string;
	skuCode: string;
	price: number;
	attributes: Record<string, unknown>;
}) {
	return json<ManagedProductSku>('/api/management/products/skus', body('POST', input));
}

export function updateProductSku(
	skuId: string,
	input: { skuCode?: string; price?: number; attributes?: Record<string, unknown> }
) {
	return json<ManagedProductSku>(`/api/management/products/skus/${skuId}`, body('PATCH', input));
}

export function deleteProductSku(skuId: string) {
	return adminApiClient.requestNoContent(`/api/management/products/skus/${skuId}`, {
		method: 'DELETE'
	});
}

export function createImageUploadTarget(
	skuId: string,
	input: { fileName: string; contentType: string; fileSize: number }
) {
	return json<{ uploadId: string; uploadUrl: string; assetKey: string; expiresAt: Date }>(
		`/api/management/products/skus/${skuId}/images/upload-url`,
		body('POST', input)
	);
}

export function registerProductImage(
	skuId: string,
	input: {
		uploadId: string;
		altText: string;
		type: 'thumbnail' | 'gallery';
		focusX?: number | null;
		focusY?: number | null;
		zoom?: number | null;
	}
) {
	return json<ManagedProductImage>(
		`/api/management/products/skus/${skuId}/images`,
		body('POST', input)
	);
}

export function updateProductImageCrop(
	skuId: string,
	imageId: string,
	input: { focusX: number; focusY: number; zoom: number }
) {
	return json<ManagedProductImage>(
		`/api/management/products/skus/${skuId}/images/${imageId}/crop`,
		body('PATCH', input)
	);
}

export function deleteProductImage(
	skuId: string,
	imageId: string,
	options: { force?: boolean; deleteAsset?: boolean } = {}
) {
	const params = new URLSearchParams();
	if (options.force) params.set('force', 'true');
	if (options.deleteAsset) params.set('deleteAsset', 'true');
	return json<{ deleted: boolean; mode: 'soft' | 'force'; assetDeleted: boolean }>(
		`/api/management/products/skus/${skuId}/images/${imageId}${params.size ? `?${params}` : ''}`,
		{ method: 'DELETE' }
	);
}

export function restoreProductImage(skuId: string, imageId: string) {
	return json<ManagedProductImage>(
		`/api/management/products/skus/${skuId}/images/${imageId}/restore`,
		body('POST', {})
	);
}

export async function loadStaffPageData(searchParams = new URLSearchParams()) {
	const [roles, staff] = await Promise.all([
		json<ManagedRole[]>('/api/management/staff/roles'),
		loadPaginatedData<ManagedStaff>('/api/management/staff', searchParams)
	]);
	return { roles, staff: staff.data, pagination: staff.pagination };
}

export function createStaff(input: { email: string; name: string; roleIds: string[] }) {
	return json<{ staff: ManagedStaff; initialPassword: string }>(
		'/api/management/staff',
		body('POST', input)
	);
}

export function updateStaff(
	staffId: string,
	input: { email?: string; name?: string; roleIds?: string[]; status?: StaffStatus }
) {
	return json<ManagedStaff>(`/api/management/staff/${staffId}`, body('PATCH', input));
}

export function deleteStaff(staffId: string) {
	return adminApiClient.requestNoContent(`/api/management/staff/${staffId}`, {
		method: 'DELETE'
	});
}

export function restoreStaff(staffId: string) {
	return json<ManagedStaff>(`/api/management/staff/${staffId}/restore`, body('POST', {}));
}

export function resetStaffMfa(staffId: string) {
	return adminApiClient.requestNoContent(`/api/management/staff/${staffId}/mfa/reset`, {
		method: 'POST',
		body: '{}'
	});
}

export function resetStaffPassword(staffId: string) {
	return json<{ initialPassword: string }>(
		`/api/management/staff/${staffId}/password/reset`,
		body('POST', {})
	);
}

export async function loadBusinessPageData(
	searchParams = new URLSearchParams({ includeDeleted: 'true' })
) {
	const [businesses, labels] = await Promise.all([
		loadPaginatedData<ManagedBusiness>('/api/management/businesses', searchParams),
		collectPaginatedData<ManagedBusinessLabel>(
			'/api/management/businesses/labels',
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
	return json<ManagedBusiness>('/api/management/businesses', body('POST', input));
}

export function updateBusiness(businessId: string, input: Partial<ManagedBusiness>) {
	return json<ManagedBusiness>(`/api/management/businesses/${businessId}`, body('PATCH', input));
}

export function deleteBusiness(businessId: string) {
	return adminApiClient.requestNoContent(`/api/management/businesses/${businessId}`, {
		method: 'DELETE'
	});
}

export function restoreBusiness(businessId: string) {
	return json<ManagedBusiness>(
		`/api/management/businesses/${businessId}/restore`,
		body('POST', {})
	);
}

export function bulkUpdateBusinessLabel(input: { businessIds: string[]; labelId: string | null }) {
	return json<{ updatedCount: number }>(
		'/api/management/businesses/bulk-label',
		body('PATCH', input)
	);
}

export function createBusinessLabel(input: {
	name: string;
	color: string;
	discountRate?: number | null;
}) {
	return json<ManagedBusinessLabel>('/api/management/businesses/labels', body('POST', input));
}

export function updateBusinessLabel(
	labelId: string,
	input: Partial<{ name: string; color: string; discountRate: number | null }>
) {
	return json<ManagedBusinessLabel>(
		`/api/management/businesses/labels/${labelId}`,
		body('PATCH', input)
	);
}

export function deleteBusinessLabel(labelId: string) {
	return adminApiClient.requestNoContent(`/api/management/businesses/labels/${labelId}`, {
		method: 'DELETE'
	});
}

export function restoreBusinessLabel(labelId: string) {
	return json<ManagedBusinessLabel>(
		`/api/management/businesses/labels/${labelId}/restore`,
		body('POST', {})
	);
}

export async function loadOrderPageData(searchParams = new URLSearchParams()) {
	const [businesses, orders] = await Promise.all([
		collectPaginatedData<ManagedBusiness>('/api/management/businesses'),
		loadPaginatedData<ManagedOrder>('/api/management/orders', searchParams)
	]);
	return { businesses, orders: orders.data, pagination: orders.pagination };
}

export async function loadOrderSkuLookups(search = '') {
	const params = new URLSearchParams();
	if (search.trim()) params.set('search', search.trim());
	params.set('page', '1');
	params.set('limit', String(managementPageSize));
	return json<PaginatedResponse<ManagedOrderSkuLookup>>(
		`/api/management/orders/product-skus?${params}`
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
	return json<ManagedOrder>('/api/management/orders', {
		...body('POST', input),
		headers: { 'idempotency-key': idempotencyKey }
	});
}

export function bulkUpdateProducts(input: {
	productIds: string[];
	action: 'archive' | 'restore' | 'publish' | 'unpublish';
}) {
	return json<{ updatedCount: number }>('/api/management/products/bulk', body('PATCH', input));
}

export function updateOrderStatus(orderId: string, status: OrderStatus) {
	return json<ManagedOrder>(`/api/management/orders/${orderId}/status`, body('PATCH', { status }));
}

export function updateOrder(
	orderId: string,
	input: Omit<OrderInput, 'items'> & { status: OrderStatus }
) {
	return json<ManagedOrder>(`/api/management/orders/${orderId}`, body('PATCH', input));
}

export function loadLogsPageData(searchParams = new URLSearchParams()) {
	return loadPaginatedData<ManagedLog>('/api/management/logs', searchParams);
}

export function loadLogDetail(logId: string) {
	return json<ManagedLog>(`/api/management/logs/${logId}`);
}
