import { Router } from 'express';
import {
	z,
	staffCreateSchema,
	staffDeleteQuerySchema,
	staffListQuerySchema,
	staffPasswordUpdateSchema,
	staffUpdateSchema,
	uuidSchema
} from '@packages/schemas';

import { requirePermission, requireRole } from '../../middlewares/authorize.js';
import { validateRequest } from '../../middlewares/validate-request.js';
import { createStaffManagementController } from './staff.controller.js';
import type { StaffService } from './staff.service.js';

type StaffRouterDependencies = {
	staffService: StaffService;
};

const staffParamsSchema = z.object({
	staffId: uuidSchema
});

export function createStaffManagementRouter(dependencies: StaffRouterDependencies): Router {
	const controller = createStaffManagementController(dependencies);
	const router = Router();

	router.get(
		'/',
		requirePermission('staff.read'),
		validateRequest({ query: staffListQuerySchema }),
		controller.listStaff
	);

	router.post(
		'/',
		requirePermission('staff.create'),
		validateRequest({ body: staffCreateSchema }),
		controller.createStaff
	);

	router.get(
		'/:staffId',
		requirePermission('staff.read'),
		validateRequest({ params: staffParamsSchema }),
		controller.getStaff
	);

	router.patch(
		'/:staffId',
		requirePermission('staff.update'),
		validateRequest({ params: staffParamsSchema, body: staffUpdateSchema }),
		controller.updateStaff
	);

	router.delete(
		'/:staffId',
		requirePermission('staff.delete'),
		validateRequest({ params: staffParamsSchema, query: staffDeleteQuerySchema }),
		controller.deleteStaff
	);

	router.patch(
		'/:staffId/password',
		requirePermission('staff.update'),
		requireRole('admin'),
		validateRequest({ params: staffParamsSchema, body: staffPasswordUpdateSchema }),
		controller.updatePassword
	);

	return router;
}
