import { Router } from 'express';
import {
	orderCreateSchema,
	orderListQuerySchema,
	orderStatusUpdateSchema,
	uuidSchema,
	z
} from '@packages/schemas';

import { requirePermission } from '../../../middlewares/authorize.js';
import { validateRequest } from '../../../middlewares/validate-request.js';
import type { LogService } from '../log/log.service.js';
import { createOrderManagementController } from './order.controller.js';
import type { OrderService } from './order.service.js';

type OrderRouterDependencies = {
	orderService: OrderService;
	logService: Pick<LogService, 'recordAuditLog'>;
};

const orderParamsSchema = z.object({
	orderId: uuidSchema
});

export function createOrderManagementRouter(dependencies: OrderRouterDependencies): Router {
	const controller = createOrderManagementController(dependencies);
	const router = Router();

	router.get(
		'/',
		requirePermission('order.read'),
		validateRequest({ query: orderListQuerySchema }),
		controller.listOrders
	);

	router.post(
		'/',
		requirePermission('order.write'),
		validateRequest({ body: orderCreateSchema }),
		controller.createOrder
	);

	router.get(
		'/:orderId',
		requirePermission('order.read'),
		validateRequest({ params: orderParamsSchema }),
		controller.getOrder
	);

	router.patch(
		'/:orderId/status',
		requirePermission('order.write'),
		validateRequest({ params: orderParamsSchema, body: orderStatusUpdateSchema }),
		controller.updateOrderStatus
	);

	return router;
}
