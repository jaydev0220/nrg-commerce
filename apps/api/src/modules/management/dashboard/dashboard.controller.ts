import type { RequestHandler } from 'express';

import { getValidatedQuery } from '../../../middlewares/validate-request.js';
import type { DashboardRange, DashboardService } from './dashboard.service.js';

type DashboardControllerDependencies = {
	dashboardService: DashboardService;
};

export function createDashboardController(dependencies: DashboardControllerDependencies) {
	const getDashboard: RequestHandler = async (request, response) => {
		const { range } = getValidatedQuery<{ range: DashboardRange }>(request);
		const dashboard = await dependencies.dashboardService.getDashboard(range);
		response.status(200).json(dashboard);
	};

	return {
		getDashboard
	};
}
