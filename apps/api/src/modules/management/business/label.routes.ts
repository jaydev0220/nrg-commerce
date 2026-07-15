import { Router } from 'express';
import {
	businessLabelCreateSchema,
	businessLabelListQuerySchema,
	businessLabelUpdateSchema,
	uuidSchema,
	z
} from '@packages/schemas';

import { requirePermission } from '../../../middlewares/authorize.js';
import { validateRequest } from '../../../middlewares/validate-request.js';
import type { LogService } from '../log/log.service.js';
import { createBusinessLabelController } from './label.controller.js';
import type { BusinessLabelService } from './label.service.js';

type BusinessLabelRouterDependencies = {
	labelService: BusinessLabelService;
	logService: Pick<LogService, 'recordAuditLog'>;
};

const paramsSchema = z.object({ labelId: uuidSchema });

export function createBusinessLabelRouter(dependencies: BusinessLabelRouterDependencies): Router {
	const controller = createBusinessLabelController(dependencies);
	const router = Router();
	router.get(
		'/',
		requirePermission('business.read'),
		validateRequest({ query: businessLabelListQuerySchema }),
		controller.list
	);
	router.post(
		'/',
		requirePermission('business.write'),
		validateRequest({ body: businessLabelCreateSchema }),
		controller.create
	);
	router.patch(
		'/:labelId',
		requirePermission('business.write'),
		validateRequest({ params: paramsSchema, body: businessLabelUpdateSchema }),
		controller.update
	);
	router.delete(
		'/:labelId',
		requirePermission('business.write'),
		validateRequest({ params: paramsSchema }),
		controller.remove
	);
	router.post(
		'/:labelId/restore',
		requirePermission('business.write'),
		validateRequest({ params: paramsSchema }),
		controller.restore
	);
	return router;
}
