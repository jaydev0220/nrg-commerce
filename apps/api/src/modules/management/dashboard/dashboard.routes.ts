import { Router } from 'express';
import { z } from '@packages/schemas';

import { validateRequest } from '../../../middlewares/validate-request.js';
import { createDashboardController } from './dashboard.controller.js';
import type { DashboardService } from './dashboard.service.js';

type DashboardRouterDependencies = {
	dashboardService: DashboardService;
};

export function createDashboardRouter(dependencies: DashboardRouterDependencies): Router {
	const controller = createDashboardController(dependencies);
	const router = Router();
	const querySchema = z.object({
		range: z.enum(['days', 'months', 'quarters']).default('days')
	});

	router.get('/', validateRequest({ query: querySchema }), controller.getDashboard);

	return router;
}
