import { PUBLIC_API_BASE_URL } from '$env/static/public';

type ApiErrorPayload = {
	error?: {
		code?: string;
		message?: string;
		details?: unknown;
	};
};

type ClientOptions = {
	baseUrl: string;
	fetch: typeof globalThis.fetch;
	onSessionExpired?: () => void;
};

type RequestOptions = {
	authenticated?: boolean;
	retryOnUnauthorized?: boolean;
};

export class AdminApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly code: string | null = null,
		readonly details: unknown = null
	) {
		super(message);
		this.name = 'AdminApiError';
	}
}

function isMutation(method: string | undefined): boolean {
	return !['GET', 'HEAD', 'OPTIONS'].includes((method ?? 'GET').toUpperCase());
}

async function readError(response: Response): Promise<AdminApiError> {
	let payload: ApiErrorPayload = {};
	try {
		payload = (await response.json()) as ApiErrorPayload;
	} catch {
		// The status still provides a useful failure when an upstream returns non-JSON.
	}
	return new AdminApiError(
		response.status,
		payload.error?.message ?? '管理 API 請求失敗。',
		payload.error?.code ?? null,
		payload.error?.details ?? null
	);
}

export function createAdminApiClient(options: ClientOptions) {
	const baseUrl = options.baseUrl.replace(/\/+$/, '');
	let csrfToken: string | null = null;
	let csrfRequest: Promise<string> | null = null;
	let refreshRequest: Promise<boolean> | null = null;
	let sessionExpiryHandled = false;
	const refreshLockName = 'nrg-admin-auth-refresh';
	const refreshLeaseKey = 'nrg-admin-auth-refresh-lease';
	const refreshLeaseDurationMs = 10_000;
	const refreshChannelName = 'nrg-admin-auth-refresh-events';
	const refreshWaiters = new Set<() => void>();
	const refreshChannel =
		typeof window === 'undefined' || typeof BroadcastChannel === 'undefined'
			? null
			: new BroadcastChannel(refreshChannelName);

	if (refreshChannel) {
		refreshChannel.onmessage = (event: MessageEvent<{ type?: string }>) => {
			if (event.data?.type !== 'completed') return;
			for (const resolve of refreshWaiters) resolve();
			refreshWaiters.clear();
		};
	}

	function url(path: string): string {
		return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
	}

	async function fetchCsrfToken(): Promise<string> {
		if (csrfToken) return csrfToken;
		csrfRequest ??= options
			.fetch(url('/api/auth/csrf'), {
				method: 'GET',
				credentials: 'include',
				headers: { accept: 'application/json' }
			})
			.then(async (response) => {
				if (!response.ok) throw await readError(response);
				const payload = (await response.json()) as { csrfToken?: string };
				if (!payload.csrfToken) {
					throw new AdminApiError(500, 'API 未回傳 CSRF 權杖。', 'INVALID_CSRF_RESPONSE');
				}
				csrfToken = payload.csrfToken;
				return payload.csrfToken;
			})
			.finally(() => {
				csrfRequest = null;
			});
		return csrfRequest;
	}

	async function send(path: string, init: RequestInit = {}): Promise<Response> {
		const headers = new Headers(init.headers);
		headers.set('accept', 'application/json');
		if (init.body && !headers.has('content-type') && !(init.body instanceof FormData)) {
			headers.set('content-type', 'application/json');
		}
		if (isMutation(init.method)) {
			headers.set('x-csrf-token', await fetchCsrfToken());
		}
		return options.fetch(url(path), { ...init, credentials: 'include', headers });
	}

	async function readAuthState(): Promise<string | null> {
		const response = await options.fetch(url('/api/auth/state'), {
			method: 'GET',
			credentials: 'include',
			headers: { accept: 'application/json' }
		});
		if (!response.ok) return null;
		const payload = (await response.json()) as { status?: string };
		return payload.status ?? null;
	}

	async function sendWithCsrfRetry(path: string, init: RequestInit = {}): Promise<Response> {
		let response = await send(path, init);
		if (response.status !== 403 || !isMutation(init.method)) return response;

		const error = await readError(response.clone());
		if (error.code !== 'CSRF_VALIDATION_FAILED') return response;

		csrfToken = null;
		response = await send(path, init);
		return response;
	}

	async function rotateSession(): Promise<boolean> {
		const response = await sendWithCsrfRetry('/api/auth/refresh', {
			method: 'POST',
			body: '{}'
		});
		return response.ok;
	}

	function publishRefreshEvent(type: 'started' | 'completed', succeeded?: boolean): void {
		refreshChannel?.postMessage({ type, succeeded, sentAt: Date.now() });
	}

	async function waitForRefreshEvent(timeoutMs = 100): Promise<void> {
		if (!refreshChannel) {
			await new Promise((resolve) => setTimeout(resolve, timeoutMs));
			return;
		}

		await new Promise<void>((resolve) => {
			function finish() {
				clearTimeout(timeout);
				refreshWaiters.delete(finish);
				resolve();
			}
			const timeout = setTimeout(() => {
				refreshWaiters.delete(finish);
				resolve();
			}, timeoutMs);
			refreshWaiters.add(finish);
		});
	}

	async function performRotation(): Promise<boolean> {
		publishRefreshEvent('started');
		let succeeded = false;
		try {
			succeeded = await rotateSession();
			return succeeded;
		} finally {
			publishRefreshEvent('completed', succeeded);
		}
	}

	async function waitForStorageLease(): Promise<() => void> {
		if (typeof localStorage === 'undefined') return () => undefined;
		const owner = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

		for (;;) {
			try {
				const current = JSON.parse(localStorage.getItem(refreshLeaseKey) ?? 'null') as {
					owner?: string;
					expiresAt?: number;
				} | null;
				if (!current?.owner || !current.expiresAt || current.expiresAt <= Date.now()) {
					localStorage.setItem(
						refreshLeaseKey,
						JSON.stringify({ owner, expiresAt: Date.now() + refreshLeaseDurationMs })
					);
					const acquired = JSON.parse(localStorage.getItem(refreshLeaseKey) ?? 'null') as {
						owner?: string;
					};
					if (acquired.owner === owner) {
						return () => {
							try {
								const latest = JSON.parse(localStorage.getItem(refreshLeaseKey) ?? 'null') as {
									owner?: string;
								} | null;
								if (latest?.owner === owner) localStorage.removeItem(refreshLeaseKey);
							} catch {
								// Storage can be unavailable after the lease was acquired.
							}
						};
					}
				}
			} catch {
				return () => undefined;
			}
			await waitForRefreshEvent(100);
		}
	}

	async function refreshSession(): Promise<boolean> {
		if (refreshRequest) return refreshRequest;

		const run = async (): Promise<boolean> => {
			const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
			if (!locks) {
				const release = await waitForStorageLease();
				try {
					const state = await readAuthState().catch(() => null);
					if (state === 'authenticated') return true;
					return await performRotation();
				} finally {
					release();
				}
			}

			return locks.request(refreshLockName, async () => {
				const state = await readAuthState().catch(() => null);
				if (state === 'authenticated') return true;
				return performRotation();
			});
		};

		refreshRequest = run()
			.catch(() => false)
			.finally(() => {
				refreshRequest = null;
			});
		return refreshRequest;
	}

	async function waitForRefresh(): Promise<void> {
		if (refreshRequest) await refreshRequest;
	}

	function handleSessionExpired(): void {
		if (sessionExpiryHandled) return;
		sessionExpiryHandled = true;
		if (options.onSessionExpired) {
			options.onSessionExpired();
			return;
		}
		if (typeof window !== 'undefined') {
			window.location.assign('/login?reason=session-expired');
		}
	}

	async function request(
		path: string,
		init: RequestInit = {},
		requestOptions: RequestOptions = {}
	): Promise<Response> {
		const authenticated = requestOptions.authenticated ?? true;
		const retryOnUnauthorized = requestOptions.retryOnUnauthorized ?? authenticated;
		if (authenticated && sessionExpiryHandled) {
			throw new AdminApiError(401, '登入階段已過期，請重新登入。', 'SESSION_EXPIRED');
		}
		if (authenticated && path !== '/api/auth/refresh') await waitForRefresh();
		let response = await sendWithCsrfRetry(path, init);
		if (response.status === 401 && authenticated && retryOnUnauthorized) {
			if (await refreshSession()) {
				response = await sendWithCsrfRetry(path, init);
			}
			if (response.status === 401) handleSessionExpired();
		}
		if (!response.ok) throw await readError(response);
		return response;
	}

	return {
		request,
		async requestJson<T>(
			path: string,
			init: RequestInit = {},
			requestOptions: RequestOptions = {}
		): Promise<T> {
			const response = await request(path, init, requestOptions);
			return (await response.json()) as T;
		},
		async requestNoContent(
			path: string,
			init: RequestInit = {},
			requestOptions: RequestOptions = {}
		): Promise<void> {
			await request(path, init, requestOptions);
		},
		clearCsrfToken(): void {
			csrfToken = null;
		},
		refreshSession(): Promise<boolean> {
			return refreshSession();
		}
	};
}

export const adminApiClient = createAdminApiClient({
	baseUrl: PUBLIC_API_BASE_URL || 'http://localhost:3000',
	fetch: (...args) => globalThis.fetch(...args)
});
