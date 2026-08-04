import cors from 'cors';

function isLocalOrigin(origin: string): boolean {
	try {
		const url = new URL(origin);
		return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
	} catch {
		return false;
	}
}

export const localCors = cors({
	credentials: true,
	origin(origin, callback) {
		if (!origin || isLocalOrigin(origin)) {
			callback(null, true);
			return;
		}
		callback(new Error(`Mock API rejected non-local CORS origin: ${origin}`));
	},
	allowedHeaders: ['accept', 'content-type', 'x-csrf-token', 'idempotency-key'],
	methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
});
