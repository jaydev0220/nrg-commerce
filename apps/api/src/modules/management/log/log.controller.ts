import type { RequestHandler } from 'express';

import { getValidatedQuery } from '../../../middlewares/validate-request.js';
import { buildPaginatedResponse } from '../../../utils/pagination.js';
import type { LogService } from './log.service.js';

type LogManagementControllerDependencies = {
	logService: LogService;
};

type LogManagementController = {
	listLogs: RequestHandler;
};

export function createLogManagementController(dependencies: LogManagementControllerDependencies) {
	const controller: LogManagementController = {
		listLogs: async (request, response) => {
			const query = getValidatedQuery<Parameters<LogService['listLogs']>[0]>(request);
			const result = await dependencies.logService.listLogs(query);

			response.status(200).json(
				buildPaginatedResponse(result.data, {
					page: query.page,
					limit: query.limit,
					total: result.total
				})
			);
		}
	};

	return controller;
}
