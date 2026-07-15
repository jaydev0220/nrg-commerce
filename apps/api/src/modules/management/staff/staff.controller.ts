import type { RequestHandler } from 'express';

import { requireAuthContext } from '../../../middlewares/authenticate.js';
import { getRequestContext, getRequestPath } from '../../../middlewares/request-context.js';
import {
	getValidatedBody,
	getValidatedParams,
	getValidatedQuery
} from '../../../middlewares/validate-request.js';
import { buildPaginatedResponse } from '../../../utils/pagination.js';
import type { LogService } from '../log/log.service.js';
import type { StaffService } from './staff.service.js';

type StaffControllerDependencies = {
	staffService: StaffService;
	logService: Pick<LogService, 'recordAuditLog'>;
};

type StaffParams = {
	staffId: string;
};
type StaffManagementController = {
	listStaff: RequestHandler;
	listRoles: RequestHandler;
	createStaff: RequestHandler;
	getStaff: RequestHandler;
	updateStaff: RequestHandler;
	deleteStaff: RequestHandler;
	restoreStaff: RequestHandler;
	resetMfa: RequestHandler;
	resetPassword: RequestHandler;
	updatePassword: RequestHandler;
};

export function createStaffManagementController(dependencies: StaffControllerDependencies) {
	const controller: StaffManagementController = {
		listStaff: async (request, response) => {
			const query = getValidatedQuery<Parameters<StaffService['listStaff']>[0]>(request);
			const result = await dependencies.staffService.listStaff(query);
			response.status(200).json(
				buildPaginatedResponse(result.data, {
					page: query.page,
					limit: query.limit,
					total: result.total
				})
			);
		},

		listRoles: async (_request, response) => {
			response.status(200).json(await dependencies.staffService.listRoles());
		},

		createStaff: async (request, response) => {
			const authContext = requireAuthContext(response);
			const body = getValidatedBody<Parameters<StaffService['createStaff']>[0]>(request);
			const result = await dependencies.staffService.createStaff(body);
			const { staff } = result;
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff created a staff account.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 201,
				entityType: 'staff',
				entityId: staff.id
			});
			response.status(201).location(`/api/management/staff/${staff.id}`).json(result);
		},

		getStaff: async (request, response) => {
			const params = getValidatedParams<StaffParams>(request);
			const staff = await dependencies.staffService.getStaff(params.staffId);
			response.status(200).json(staff);
		},

		updateStaff: async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<StaffParams>(request);
			const body = getValidatedBody<Parameters<StaffService['updateStaff']>[2]>(request);
			const staff = await dependencies.staffService.updateStaff(
				{
					id: authContext.staffId,
					roles: authContext.roles
				},
				params.staffId,
				body
			);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff updated a staff account.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'staff',
				entityId: staff.id
			});
			response.status(200).json(staff);
		},

		deleteStaff: async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<StaffParams>(request);
			const query = getValidatedQuery<{ force: boolean }>(request);
			const mode = await dependencies.staffService.deleteStaff(
				{
					id: authContext.staffId,
					roles: authContext.roles
				},
				params.staffId,
				query.force
			);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff deleted a staff account.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'staff',
				entityId: params.staffId,
				metadata: { mode }
			});
			response.status(200).json({
				deleted: true,
				mode
			});
		},

		restoreStaff: async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<StaffParams>(request);
			const staff = await dependencies.staffService.restoreStaff(params.staffId);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff restored a staff account.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'staff',
				entityId: staff.id
			});
			response.status(200).json(staff);
		},

		resetMfa: async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<StaffParams>(request);
			await dependencies.staffService.resetMfa(params.staffId);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff reset MFA for a staff account.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 204,
				entityType: 'staff',
				entityId: params.staffId
			});
			response.status(204).send();
		},

		resetPassword: async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<StaffParams>(request);
			const initialPassword = await dependencies.staffService.resetPassword(
				{ id: authContext.staffId, roles: authContext.roles },
				params.staffId
			);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff reset a staff account password.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'staff',
				entityId: params.staffId
			});
			response.status(200).json({ initialPassword });
		},

		updatePassword: async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<StaffParams>(request);
			const body = getValidatedBody<{ password: string }>(request);
			await dependencies.staffService.updatePassword(
				{
					id: authContext.staffId,
					roles: authContext.roles
				},
				params.staffId,
				body.password
			);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff updated a staff account password.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 204,
				entityType: 'staff',
				entityId: params.staffId
			});
			response.status(204).send();
		}
	};

	return controller;
}
