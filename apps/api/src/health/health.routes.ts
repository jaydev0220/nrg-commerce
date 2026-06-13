import { Router } from 'express';

export type HealthDependencies = {
	isReady: () => Promise<boolean>;
};

export function createHealthRouter(dependencies: HealthDependencies): Router {
	const router = Router();

	router.get('/liveness', (_request, response) => {
		response.status(200).json({ status: 'ok' });
	});

	router.get('/readiness', async (_request, response) => {
		const isReady = await dependencies.isReady();

		response.status(isReady ? 200 : 503).json({ status: isReady ? 'ready' : 'not_ready' });
	});

	return router;
}
