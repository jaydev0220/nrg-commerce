import { Router } from 'express';

import { createDashboardController } from './dashboard.controller.js';
import type { DashboardService } from './dashboard.service.js';

type DashboardRouterDependencies = {
	dashboardService: DashboardService;
};

export function createDashboardRouter(dependencies: DashboardRouterDependencies): Router {
	const controller = createDashboardController(dependencies);
	const router = Router();

	router.get('/', controller.getDashboard);

	return router;
}
