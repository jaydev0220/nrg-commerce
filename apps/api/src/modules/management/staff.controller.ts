import type { RequestHandler } from 'express';

import { requireAuthContext } from '../../middlewares/authenticate.js';
import {
	getValidatedBody,
	getValidatedParams,
	getValidatedQuery
} from '../../middlewares/validate-request.js';
import { buildPaginatedResponse } from '../../utils/pagination.js';
import type { StaffService } from './staff.service.js';

type StaffControllerDependencies = {
	staffService: StaffService;
};

type StaffParams = {
	staffId: string;
};
type StaffManagementController = {
	listStaff: RequestHandler;
	createStaff: RequestHandler;
	getStaff: RequestHandler;
	updateStaff: RequestHandler;
	deleteStaff: RequestHandler;
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

		createStaff: async (request, response) => {
			const body = getValidatedBody<Parameters<StaffService['createStaff']>[0]>(request);
			const staff = await dependencies.staffService.createStaff(body);
			response.status(201).location(`/api/management/staff/${staff.id}`).json(staff);
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
			response.status(200).json({
				deleted: true,
				mode
			});
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
			response.status(204).send();
		}
	};

	return controller;
}
