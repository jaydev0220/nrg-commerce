import type { RequestHandler } from 'express';
import { orderIdempotencyKeySchema } from '@packages/schemas';

import { AppError } from '../../../errors/app-error.js';
import { requireAuthContext } from '../../../middlewares/authenticate.js';
import { getRequestContext, getRequestPath } from '../../../middlewares/request-context.js';
import {
	getValidatedBody,
	getValidatedParams,
	getValidatedQuery
} from '../../../middlewares/validate-request.js';
import { buildPaginatedResponse } from '../../../utils/pagination.js';
import type { LogService } from '../log/log.service.js';
import type { OrderService } from './order.service.js';

type OrderControllerDependencies = {
	orderService: OrderService;
	logService: Pick<LogService, 'recordAuditLog'>;
};

type OrderParams = {
	orderId: string;
};

export function createOrderManagementController(dependencies: OrderControllerDependencies) {
	return {
		listOrders: (async (request, response) => {
			const query = getValidatedQuery<Parameters<OrderService['listOrders']>[0]>(request);
			const result = await dependencies.orderService.listOrders(query);
			response.status(200).json(
				buildPaginatedResponse(result.data, {
					page: query.page,
					limit: query.limit,
					total: result.total
				})
			);
		}) satisfies RequestHandler,

		listOrderSkuLookups: (async (request, response) => {
			const query = getValidatedQuery<Parameters<OrderService['listOrderSkuLookups']>[0]>(request);
			const result = await dependencies.orderService.listOrderSkuLookups(query);
			response.status(200).json(
				buildPaginatedResponse(result.data, {
					page: query.page,
					limit: query.limit,
					total: result.total
				})
			);
		}) satisfies RequestHandler,

		createOrder: (async (request, response) => {
			const authContext = requireAuthContext(response);
			const body = getValidatedBody<Parameters<OrderService['createOrder']>[0]>(request);
			const idempotencyKeyResult = orderIdempotencyKeySchema.safeParse(
				request.get('idempotency-key')
			);
			if (!idempotencyKeyResult.success) {
				throw new AppError(
					400,
					'IDEMPOTENCY_KEY_REQUIRED',
					'A valid Idempotency-Key header is required when creating an order.'
				);
			}
			const order = await dependencies.orderService.createOrder({
				...body,
				idempotencyKey: idempotencyKeyResult.data
			});
			const { reused, ...orderRecord } = order;
			const requestContext = getRequestContext(request, response);
			if (!reused) {
				await dependencies.logService.recordAuditLog({
					message: 'Staff created an order.',
					actorStaffId: authContext.staffId,
					requestId: requestContext.requestId,
					method: request.method,
					path: getRequestPath(request),
					statusCode: 201,
					entityType: 'order',
					entityId: order.id
				});
			}
			response
				.status(reused ? 200 : 201)
				.location(`/api/management/orders/${orderRecord.id}`)
				.json(orderRecord);
		}) satisfies RequestHandler,

		getOrder: (async (request, response) => {
			const params = getValidatedParams<OrderParams>(request);
			const order = await dependencies.orderService.getOrder(params.orderId);
			response.status(200).json(order);
		}) satisfies RequestHandler,

		updateOrderStatus: (async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<OrderParams>(request);
			const body = getValidatedBody<{ status: Parameters<OrderService['updateOrderStatus']>[1] }>(
				request
			);
			const result = await dependencies.orderService.updateOrderStatus(params.orderId, body.status);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff updated an order status.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'order',
				entityId: result.order.id,
				metadata: {
					previousStatus: result.previousStatus,
					status: result.order.status
				}
			});
			response.status(200).json(result.order);
		}) satisfies RequestHandler,
		updateOrder: (async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<OrderParams>(request);
			const body = getValidatedBody<Parameters<OrderService['updateOrder']>[1]>(request);
			const result = await dependencies.orderService.updateOrder(params.orderId, body);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff updated an order.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'order',
				entityId: result.order.id,
				metadata: { previousStatus: result.previousStatus, status: result.order.status }
			});
			response.status(200).json(result.order);
		}) satisfies RequestHandler
	};
}
