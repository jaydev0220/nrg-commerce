import type { RequestHandler } from 'express';

import type { DashboardService } from './dashboard.service.js';

type DashboardControllerDependencies = {
	dashboardService: DashboardService;
};

export function createDashboardController(dependencies: DashboardControllerDependencies) {
	const getDashboard: RequestHandler = async (_request, response) => {
		const dashboard = await dependencies.dashboardService.getDashboard();
		response.status(200).json(dashboard);
	};

	return {
		getDashboard
	};
}
