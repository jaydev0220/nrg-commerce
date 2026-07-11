import { env } from '$env/dynamic/private';
import { error, isRedirect, redirect, type Cookies, type RequestEvent } from '@sveltejs/kit';
import {
	logKindSchema,
	logLevelSchema,
	mfaMethodSchema,
	orderStatusSchema,
	permissionKeySchema,
	roleKeySchema,
	staffStatusSchema,
	z
} from '@packages/schemas';

const accessTokenCookieName = 'admin_access_token';
const refreshTokenCookieName = 'admin_refresh_token';
const sessionCookieMaxAgeSeconds = 60 * 60 * 24 * 7;
const pageSize = 100;

const jsonDateSchema = z.coerce.date();
const paginationSchema = z.object({
	page: z.number().int().min(1),
	limit: z.number().int().min(1),
	total: z.number().int().min(0),
	totalPages: z.number().int().min(0)
});

const managedRoleSchema = z.object({
	id: z.uuid(),
	key: roleKeySchema,
	name: z.string().min(1),
	permissions: z.array(permissionKeySchema).default([])
});

const currentStaffSchema = z.object({
	id: z.uuid(),
	email: z.email(),
	name: z.string().min(1),
	status: staffStatusSchema,
	mfaRequired: z.boolean(),
	preferredMfaMethod: mfaMethodSchema.nullable(),
	lastLoginAt: jsonDateSchema.nullable(),
	roles: z.array(managedRoleSchema).default([]),
	totpCredentialCount: z.number().int().min(0),
	passkeyCredentialCount: z.number().int().min(0)
});

const sessionSchema = z.object({
	id: z.uuid(),
	staffId: z.uuid(),
	userAgent: z.string().min(1).nullable(),
	ipAddress: z.string().min(1).nullable(),
	authenticatedAt: jsonDateSchema,
	lastSeenAt: jsonDateSchema.nullable(),
	expiresAt: jsonDateSchema,
	revokedAt: jsonDateSchema.nullable()
});

const authenticatedLoginSchema = z.object({
	status: z.literal('authenticated'),
	accessToken: z.string().min(1),
	refreshToken: z.string().min(1),
	session: sessionSchema,
	staff: currentStaffSchema
});

const mfaChallengeSchema = z.object({
	status: z.literal('mfa_required'),
	method: mfaMethodSchema,
	pendingToken: z.string().min(1)
});

const passwordLoginResponseSchema = z.union([authenticatedLoginSchema, mfaChallengeSchema]);

const authMeResponseSchema = z.object({
	staff: currentStaffSchema,
	sessionId: z.uuid()
});

const managedCategorySchema = z.object({
	id: z.uuid(),
	name: z.string().min(1),
	nameEn: z.string().min(1).nullable(),
	slug: z.string().min(1),
	description: z.string().min(1).nullable(),
	descriptionEn: z.string().min(1).nullable(),
	position: z.number().int().min(0),
	parentId: z.uuid().nullable(),
	deletedAt: jsonDateSchema.nullable(),
	createdAt: jsonDateSchema,
	updatedAt: jsonDateSchema
});

const managedProductSkuSchema = z.object({
	id: z.uuid(),
	productId: z.uuid(),
	productSlug: z.string().min(1),
	skuCode: z.string().min(1),
	name: z.string().min(1),
	nameEn: z.string().min(1).nullable(),
	description: z.string().min(1).nullable(),
	descriptionEn: z.string().min(1).nullable(),
	categoryId: z.uuid().nullable(),
	categorySlug: z.string().min(1).nullable(),
	price: z.number().finite().min(0),
	published: z.boolean(),
	attributes: z.record(z.string(), z.unknown()),
	deletedAt: jsonDateSchema.nullable(),
	createdAt: jsonDateSchema,
	updatedAt: jsonDateSchema,
	images: z.array(z.unknown()).default([])
});

const managedProductSchema = z.object({
	id: z.uuid(),
	slug: z.string().min(1),
	name: z.string().min(1),
	nameEn: z.string().min(1).nullable(),
	description: z.string().min(1).nullable(),
	descriptionEn: z.string().min(1).nullable(),
	categoryId: z.uuid().nullable(),
	categorySlug: z.string().min(1).nullable(),
	published: z.boolean(),
	deletedAt: jsonDateSchema.nullable(),
	createdAt: jsonDateSchema,
	updatedAt: jsonDateSchema,
	skus: z.array(managedProductSkuSchema).default([])
});

const managedStaffSchema = z.object({
	id: z.uuid(),
	email: z.email(),
	name: z.string().min(1),
	status: staffStatusSchema,
	mfaRequired: z.boolean(),
	preferredMfaMethod: mfaMethodSchema.nullable(),
	lastLoginAt: jsonDateSchema.nullable(),
	deletedAt: jsonDateSchema.nullable(),
	createdAt: jsonDateSchema,
	updatedAt: jsonDateSchema,
	roles: z.array(managedRoleSchema).default([])
});

const managedBusinessSchema = z.object({
	id: z.uuid(),
	name: z.string().min(1),
	contactName: z.string().min(1).nullable(),
	contactEmail: z.email().nullable(),
	contactPhone: z.string().min(1).nullable(),
	taxId: z.string().min(1).nullable(),
	address: z.string().min(1).nullable(),
	notes: z.string().min(1).nullable(),
	deletedAt: jsonDateSchema.nullable(),
	createdAt: jsonDateSchema,
	updatedAt: jsonDateSchema
});

const managedOrderItemSchema = z.object({
	id: z.uuid(),
	orderId: z.uuid(),
	productSkuId: z.uuid().nullable(),
	skuCode: z.string().min(1),
	productName: z.string().min(1),
	unitPrice: z.number().finite().min(0),
	quantity: z.number().int().min(1),
	lineTotal: z.number().finite().min(0),
	attributes: z.record(z.string(), z.unknown()),
	createdAt: jsonDateSchema
});

const managedOrderSchema = z.object({
	id: z.uuid(),
	businessId: z.uuid().nullable(),
	status: orderStatusSchema,
	customerName: z.string().min(1).nullable(),
	customerEmail: z.email().nullable(),
	customerPhone: z.string().min(1).nullable(),
	customerAddress: z.string().min(1).nullable(),
	itemCount: z.number().int().min(0),
	totalAmount: z.number().finite().min(0),
	createdAt: jsonDateSchema,
	updatedAt: jsonDateSchema,
	business: managedBusinessSchema.nullable(),
	items: z.array(managedOrderItemSchema).default([])
});

const managedLogSchema = z.object({
	id: z.uuid(),
	level: logLevelSchema,
	kind: logKindSchema,
	message: z.string().min(1),
	actorStaffId: z.uuid().nullable(),
	requestId: z.string().min(1).nullable(),
	method: z.string().min(1).nullable(),
	path: z.string().min(1).nullable(),
	statusCode: z.number().int().min(100).max(599).nullable(),
	entityType: z.string().min(1).nullable(),
	entityId: z.string().min(1).nullable(),
	metadata: z.unknown().nullable(),
	expiresAt: jsonDateSchema,
	createdAt: jsonDateSchema
});

const dashboardMetricSchema = z.object({
	label: z.string().min(1),
	value: z.string().min(1),
	trend: z
		.object({
			change: z.string().min(1),
			reference: z.string().min(1)
		})
		.optional()
});

const dashboardTrendPointSchema = z.object({
	label: z.string().min(1),
	value: z.number().int().min(0)
});

const dashboardRecentLogSchema = z.object({
	id: z.uuid(),
	message: z.string().min(1),
	level: logLevelSchema,
	kind: logKindSchema,
	createdAt: jsonDateSchema
});

const dashboardMixItemSchema = z.object({
	label: z.string().min(1),
	value: z.number().int().min(0)
});

const dashboardSignalSchema = z.object({
	label: z.string().min(1),
	value: z.string().min(1),
	note: z.string().min(1)
});

const dashboardResponseSchema = z.object({
	metrics: z.array(dashboardMetricSchema),
	activityTrend: z.array(dashboardTrendPointSchema),
	recentLogs: z.array(dashboardRecentLogSchema),
	productMix: z.array(dashboardMixItemSchema),
	signals: z.array(dashboardSignalSchema)
});

const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
	z.object({
		data: z.array(itemSchema),
		pagination: paginationSchema
	});

type ApiErrorPayload = {
	error?: {
		code?: string;
		message?: string;
		details?: unknown;
	};
};

export class AdminApiError extends Error {
	status: number;
	code: string | null;
	details: unknown;

	constructor(
		status: number,
		message: string,
		code: string | null = null,
		details: unknown = null
	) {
		super(message);
		this.name = 'AdminApiError';
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

function resolveApiBaseUrl(): string {
	return (env['API_BASE_URL'] ?? 'http://localhost:3000').replace(/\/+$/, '');
}

function buildApiUrl(path: string): string {
	return `${resolveApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

function setSessionCookies(
	cookies: Cookies,
	tokens: { accessToken: string; refreshToken: string }
): void {
	const cookieOptions = {
		httpOnly: true,
		path: '/',
		sameSite: 'lax' as const,
		secure: env['NODE_ENV'] === 'production',
		maxAge: sessionCookieMaxAgeSeconds
	};

	cookies.set(accessTokenCookieName, tokens.accessToken, cookieOptions);
	cookies.set(refreshTokenCookieName, tokens.refreshToken, cookieOptions);
}

export function clearSessionCookies(cookies: Cookies): void {
	const cookieOptions = {
		httpOnly: true,
		path: '/',
		sameSite: 'lax' as const,
		secure: env['NODE_ENV'] === 'production',
		maxAge: 0
	};

	cookies.set(accessTokenCookieName, '', cookieOptions);
	cookies.set(refreshTokenCookieName, '', cookieOptions);
}

function readAccessToken(cookies: Cookies): string | null {
	return cookies.get(accessTokenCookieName) ?? null;
}

function readRefreshToken(cookies: Cookies): string | null {
	return cookies.get(refreshTokenCookieName) ?? null;
}

async function readErrorPayload(response: Response): Promise<ApiErrorPayload> {
	try {
		return (await response.json()) as ApiErrorPayload;
	} catch {
		return {};
	}
}

async function throwApiError(response: Response): Promise<never> {
	const payload = await readErrorPayload(response);
	throw new AdminApiError(
		response.status,
		payload.error?.message ?? '管理 API 請求失敗。',
		payload.error?.code ?? null,
		payload.error?.details ?? null
	);
}

function createRequestHeaders(
	headers: HeadersInit | undefined,
	accessToken: string | null,
	body?: BodyInit | null
): Headers {
	const requestHeaders = new Headers(headers);
	requestHeaders.set('accept', 'application/json');

	if (body && !requestHeaders.has('content-type')) {
		requestHeaders.set('content-type', 'application/json');
	}

	if (accessToken) {
		requestHeaders.set('authorization', `Bearer ${accessToken}`);
	}

	return requestHeaders;
}

async function sendRequest(
	event: RequestEvent,
	path: string,
	init: RequestInit = {},
	accessToken: string | null
): Promise<Response> {
	return event.fetch(buildApiUrl(path), {
		...init,
		headers: createRequestHeaders(init.headers, accessToken, init.body)
	});
}

async function refreshAuthenticatedSession(event: RequestEvent): Promise<string | null> {
	const refreshToken = readRefreshToken(event.cookies);

	if (!refreshToken) {
		clearSessionCookies(event.cookies);
		return null;
	}

	const response = await sendRequest(
		event,
		'/api/auth/refresh',
		{
			method: 'POST',
			body: JSON.stringify({ refreshToken })
		},
		null
	);

	if (!response.ok) {
		clearSessionCookies(event.cookies);
		return null;
	}

	const payload = authenticatedLoginSchema.parse(await response.json());
	setSessionCookies(event.cookies, payload);
	return payload.accessToken;
}

async function apiRequest(
	event: RequestEvent,
	path: string,
	init: RequestInit = {},
	options: {
		authenticated?: boolean;
		retryOnUnauthorized?: boolean;
	} = {}
): Promise<Response> {
	const authenticated = options.authenticated ?? true;
	const retryOnUnauthorized = options.retryOnUnauthorized ?? authenticated;
	const accessToken = authenticated ? readAccessToken(event.cookies) : null;

	if (authenticated && !accessToken) {
		clearSessionCookies(event.cookies);
		throw redirect(303, '/login');
	}

	let response = await sendRequest(event, path, init, accessToken);

	if (response.status !== 401 || !retryOnUnauthorized || !authenticated) {
		return response;
	}

	const nextAccessToken = await refreshAuthenticatedSession(event);

	if (!nextAccessToken) {
		throw redirect(303, '/login');
	}

	response = await sendRequest(event, path, init, nextAccessToken);

	if (response.status === 401) {
		clearSessionCookies(event.cookies);
		throw redirect(303, '/login');
	}

	return response;
}

async function parseApiResponse<T>(
	event: RequestEvent,
	path: string,
	schema: z.ZodType<T>,
	init?: RequestInit,
	options?: {
		authenticated?: boolean;
		retryOnUnauthorized?: boolean;
	}
): Promise<T> {
	const response = await apiRequest(event, path, init, options);

	if (!response.ok) {
		await throwApiError(response);
	}

	return schema.parse(await response.json());
}

async function collectPaginatedData<T>(
	event: RequestEvent,
	pathname: string,
	schema: z.ZodType<T>,
	searchParams: URLSearchParams = new URLSearchParams()
): Promise<T[]> {
	const collectedItems: T[] = [];
	let page = 1;

	while (true) {
		const params = new URLSearchParams(searchParams);
		params.set('page', String(page));
		params.set('limit', String(pageSize));

		const response = await parseApiResponse(
			event,
			`${pathname}?${params.toString()}`,
			paginatedResponseSchema(schema)
		);

		collectedItems.push(...response.data);

		if (page >= response.pagination.totalPages || response.pagination.totalPages === 0) {
			break;
		}

		page += 1;
	}

	return collectedItems;
}

export function formatDate(value: Date | null): string {
	if (!value) {
		return '尚無資料';
	}

	return new Intl.DateTimeFormat('zh-TW', {
		dateStyle: 'medium'
	}).format(value);
}

export function formatDateTime(value: Date): string {
	return new Intl.DateTimeFormat('zh-TW', {
		dateStyle: 'medium',
		timeStyle: 'short'
	}).format(value);
}

export function formatCompactDate(value: Date): string {
	return new Intl.DateTimeFormat('zh-TW', {
		month: 'numeric',
		day: 'numeric'
	}).format(value);
}

export function formatCurrencyRange(prices: number[]): string {
	if (prices.length === 0) {
		return '未設定';
	}

	const formatter = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
	const sortedPrices = [...prices].sort((left, right) => left - right);
	const minimumPrice = sortedPrices[0]!;
	const maximumPrice = sortedPrices.at(-1)!;

	if (minimumPrice === maximumPrice) {
		return formatter.format(minimumPrice);
	}

	return `${formatter.format(minimumPrice)} - ${formatter.format(maximumPrice)}`;
}

export async function loginWithPassword(
	event: RequestEvent,
	input: { email: string; password: string }
) {
	const payload = await parseApiResponse(
		event,
		'/api/auth/login/password',
		passwordLoginResponseSchema,
		{
			method: 'POST',
			body: JSON.stringify(input)
		},
		{
			authenticated: false,
			retryOnUnauthorized: false
		}
	);

	if (payload.status === 'authenticated') {
		setSessionCookies(event.cookies, payload);
	}

	return payload;
}

export async function getOptionalCurrentStaff(event: RequestEvent) {
	const accessToken = readAccessToken(event.cookies);

	if (!accessToken) {
		return null;
	}

	try {
		return await parseApiResponse(event, '/api/auth/me', authMeResponseSchema);
	} catch (caughtError) {
		if (isRedirect(caughtError)) {
			return null;
		}

		if (caughtError instanceof AdminApiError && caughtError.status === 401) {
			clearSessionCookies(event.cookies);
			return null;
		}

		throw caughtError;
	}
}

export async function requireCurrentStaff(event: RequestEvent) {
	const currentStaff = await getOptionalCurrentStaff(event);

	if (!currentStaff) {
		throw redirect(303, '/login');
	}

	return currentStaff;
}

export async function logoutCurrentSession(event: RequestEvent): Promise<void> {
	if (!readAccessToken(event.cookies)) {
		clearSessionCookies(event.cookies);
		return;
	}

	try {
		const response = await apiRequest(
			event,
			'/api/auth/logout',
			{
				method: 'POST'
			},
			{
				authenticated: true,
				retryOnUnauthorized: false
			}
		);

		if (!response.ok && response.status !== 401) {
			await throwApiError(response);
		}
	} finally {
		clearSessionCookies(event.cookies);
	}
}

export async function loadDashboardData(event: RequestEvent) {
	return parseApiResponse(event, '/api/management/dashboard', dashboardResponseSchema);
}

export async function loadProductPageData(event: RequestEvent) {
	const [categories, products] = await Promise.all([
		collectPaginatedData(event, '/api/management/products/categories', managedCategorySchema),
		collectPaginatedData(
			event,
			'/api/management/products',
			managedProductSchema,
			new URLSearchParams({
				includeSkus: 'true'
			})
		)
	]);

	return {
		categories,
		products
	};
}

export async function loadStaffPageData(event: RequestEvent) {
	return collectPaginatedData(event, '/api/management/staff', managedStaffSchema);
}

export async function loadBusinessPageData(event: RequestEvent) {
	return collectPaginatedData(
		event,
		'/api/management/businesses',
		managedBusinessSchema,
		new URLSearchParams({ includeDeleted: 'true' })
	);
}

export async function createBusiness(
	event: RequestEvent,
	input: {
		name: string;
		contactName?: string;
		contactEmail?: string;
		contactPhone?: string;
		taxId?: string;
		address?: string;
		notes?: string;
	}
) {
	return parseApiResponse(event, '/api/management/businesses', managedBusinessSchema, {
		method: 'POST',
		body: JSON.stringify(input)
	});
}

export async function updateBusiness(
	event: RequestEvent,
	businessId: string,
	input: {
		name?: string;
		contactName?: string | null;
		contactEmail?: string | null;
		contactPhone?: string | null;
		taxId?: string | null;
		address?: string | null;
		notes?: string | null;
	}
) {
	return parseApiResponse(
		event,
		`/api/management/businesses/${businessId}`,
		managedBusinessSchema,
		{
			method: 'PATCH',
			body: JSON.stringify(input)
		}
	);
}

export async function deleteBusiness(event: RequestEvent, businessId: string) {
	const response = await apiRequest(event, `/api/management/businesses/${businessId}`, {
		method: 'DELETE'
	});

	if (!response.ok) {
		await throwApiError(response);
	}
}

export async function restoreBusiness(event: RequestEvent, businessId: string) {
	return parseApiResponse(
		event,
		`/api/management/businesses/${businessId}/restore`,
		managedBusinessSchema,
		{
			method: 'POST'
		}
	);
}

export async function loadOrderPageData(event: RequestEvent) {
	const [businesses, orders] = await Promise.all([
		collectPaginatedData(event, '/api/management/businesses', managedBusinessSchema),
		collectPaginatedData(event, '/api/management/orders', managedOrderSchema)
	]);

	return {
		businesses,
		orders
	};
}

export async function createOrder(
	event: RequestEvent,
	input: {
		businessId?: string;
		customerName?: string;
		customerEmail?: string;
		customerPhone?: string;
		customerAddress?: string;
		items: Array<{
			productSkuId?: string;
			skuCode: string;
			productName: string;
			unitPrice: number;
			quantity: number;
			attributes: Record<string, unknown>;
		}>;
	}
) {
	return parseApiResponse(event, '/api/management/orders', managedOrderSchema, {
		method: 'POST',
		body: JSON.stringify(input)
	});
}

export async function updateOrderStatus(
	event: RequestEvent,
	orderId: string,
	status: z.infer<typeof orderStatusSchema>
) {
	return parseApiResponse(event, `/api/management/orders/${orderId}/status`, managedOrderSchema, {
		method: 'PATCH',
		body: JSON.stringify({ status })
	});
}

export async function loadLogsPageData(event: RequestEvent) {
	return collectPaginatedData(event, '/api/management/logs', managedLogSchema);
}

export function asPageError(caughtError: unknown): never {
	if (caughtError instanceof AdminApiError) {
		throw error(caughtError.status, caughtError.message);
	}

	throw caughtError;
}
