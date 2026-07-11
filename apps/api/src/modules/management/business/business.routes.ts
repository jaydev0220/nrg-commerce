import { Router } from 'express';
import {
	businessCreateSchema,
	businessListQuerySchema,
	businessUpdateSchema,
	uuidSchema,
	z
} from '@packages/schemas';

import { requirePermission } from '../../../middlewares/authorize.js';
import { validateRequest } from '../../../middlewares/validate-request.js';
import type { LogService } from '../log/log.service.js';
import { createBusinessManagementController } from './business.controller.js';
import type { BusinessService } from './business.service.js';

type BusinessRouterDependencies = {
	businessService: BusinessService;
	logService: Pick<LogService, 'recordAuditLog'>;
};

const businessParamsSchema = z.object({
	businessId: uuidSchema
});

export function createBusinessManagementRouter(dependencies: BusinessRouterDependencies): Router {
	const controller = createBusinessManagementController(dependencies);
	const router = Router();

	router.get(
		'/',
		requirePermission('business.read'),
		validateRequest({ query: businessListQuerySchema }),
		controller.listBusinesses
	);

	router.post(
		'/',
		requirePermission('business.write'),
		validateRequest({ body: businessCreateSchema }),
		controller.createBusiness
	);

	router.get(
		'/:businessId',
		requirePermission('business.read'),
		validateRequest({ params: businessParamsSchema }),
		controller.getBusiness
	);

	router.patch(
		'/:businessId',
		requirePermission('business.write'),
		validateRequest({ params: businessParamsSchema, body: businessUpdateSchema }),
		controller.updateBusiness
	);

	router.delete(
		'/:businessId',
		requirePermission('business.write'),
		validateRequest({ params: businessParamsSchema }),
		controller.deleteBusiness
	);

	router.post(
		'/:businessId/restore',
		requirePermission('business.write'),
		validateRequest({ params: businessParamsSchema }),
		controller.restoreBusiness
	);

	return router;
}
