import { Router } from 'express';
import { managementLogListQuerySchema, uuidSchema, z } from '@packages/schemas';

import { requirePermission } from '../../../middlewares/authorize.js';
import { validateRequest } from '../../../middlewares/validate-request.js';
import { createLogManagementController } from './log.controller.js';
import type { LogService } from './log.service.js';

type LogManagementRouterDependencies = {
	logService: Pick<LogService, 'listLogs' | 'getLog'>;
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

	router.get(
		'/:logId',
		requirePermission('log.read'),
		validateRequest({ params: z.object({ logId: uuidSchema }) }),
		controller.getLog
	);

	return router;
}
