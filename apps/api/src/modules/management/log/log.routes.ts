import { Router } from 'express';
import { managementLogListQuerySchema } from '@packages/schemas';

import { requirePermission } from '../../../middlewares/authorize.js';
import { validateRequest } from '../../../middlewares/validate-request.js';
import { createLogManagementController } from './log.controller.js';
import type { LogService } from './log.service.js';

type LogManagementRouterDependencies = {
	logService: LogService;
};

export function createLogManagementRouter(dependencies: LogManagementRouterDependencies): Router {
	const controller = createLogManagementController(dependencies);
	const router = Router();

	router.get(
		'/',
		requirePermission('log.read'),
		validateRequest({ query: managementLogListQuerySchema }),
		controller.listLogs
	);

	return router;
}
