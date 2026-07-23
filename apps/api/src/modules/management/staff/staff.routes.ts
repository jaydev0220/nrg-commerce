import { Router } from 'express';
import {
	z,
	staffCreateSchema,
	staffListQuerySchema,
	staffUpdateSchema,
	uuidSchema
} from '@packages/schemas';

import { requirePermission, requireRole } from '../../../middlewares/authorize.js';
import { validateRequest } from '../../../middlewares/validate-request.js';
import type { LogService } from '../log/log.service.js';
import { createStaffManagementController } from './staff.controller.js';
import type { StaffService } from './staff.service.js';

type StaffRouterDependencies = {
	staffService: StaffService;
	logService: Pick<LogService, 'recordAuditLog'>;
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

	router.get('/roles', requirePermission('staff.read'), controller.listRoles);

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
		validateRequest({ params: staffParamsSchema }),
		controller.deleteStaff
	);

	router.post(
		'/:staffId/restore',
		requirePermission('staff.update'),
		validateRequest({ params: staffParamsSchema }),
		controller.restoreStaff
	);

	router.post(
		'/:staffId/mfa/reset',
		requirePermission('staff.update'),
		validateRequest({ params: staffParamsSchema }),
		controller.resetMfa
	);

	router.post(
		'/:staffId/password/reset',
		requirePermission('staff.update'),
		requireRole('admin'),
		validateRequest({ params: staffParamsSchema }),
		controller.resetPassword
	);
	return router;
}
