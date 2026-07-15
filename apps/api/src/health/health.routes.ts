import { Router } from 'express';

import { createTtlLruCache } from '../cache/ttl-cache.js';
import { redactLogValue, serializeLogError } from '../logging/log-redaction.js';
import type { ApiLogger } from '../logging/logger.js';

export type HealthDependencies = {
	isReady: () => Promise<boolean>;
	logger?: Pick<ApiLogger, 'debug'>;
	now?: () => number;
};

export function createHealthRouter(dependencies: HealthDependencies): Router {
	const router = Router();
	const readinessCache = createTtlLruCache<string, boolean>({
		ttlMs: 5_000,
		maxEntries: 1,
		now: dependencies.now,
		onEvent: (event, size) =>
			dependencies.logger?.debug(
				{ cache: 'health-readiness', event, size },
				'Health readiness cache event.'
			)
	});

	router.use((_request, response, next) => {
		response.set('cache-control', 'no-store');
		next();
	});

	router.get('/liveness', (_request, response) => {
		response.status(200).json({ status: 'ok' });
	});

	router.get('/readiness', async (_request, response) => {
		const isReady = await readinessCache.getOrLoad('database', async () => {
			try {
				return await dependencies.isReady();
			} catch (error) {
				dependencies.logger?.debug(
					{ error: redactLogValue(serializeLogError(error)) },
					'Health readiness probe failed.'
				);
				return false;
			}
		});

		response.status(isReady ? 200 : 503).json({ status: isReady ? 'ready' : 'not_ready' });
	});

	return router;
}
