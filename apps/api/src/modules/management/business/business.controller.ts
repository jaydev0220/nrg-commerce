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
import type { BusinessService } from './business.service.js';

type BusinessControllerDependencies = {
	businessService: BusinessService;
	logService: Pick<LogService, 'recordAuditLog'>;
};

type BusinessParams = {
	businessId: string;
};

export function createBusinessManagementController(dependencies: BusinessControllerDependencies) {
	return {
		listBusinesses: (async (request, response) => {
			const query = getValidatedQuery<Parameters<BusinessService['listBusinesses']>[0]>(request);
			const result = await dependencies.businessService.listBusinesses(query);
			response.status(200).json(
				buildPaginatedResponse(result.data, {
					page: query.page,
					limit: query.limit,
					total: result.total
				})
			);
		}) satisfies RequestHandler,

		createBusiness: (async (request, response) => {
			const authContext = requireAuthContext(response);
			const body = getValidatedBody<Parameters<BusinessService['createBusiness']>[0]>(request);
			const business = await dependencies.businessService.createBusiness(body);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff created a business.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 201,
				entityType: 'business',
				entityId: business.id
			});
			response.status(201).location(`/api/management/businesses/${business.id}`).json(business);
		}) satisfies RequestHandler,

		getBusiness: (async (request, response) => {
			const params = getValidatedParams<BusinessParams>(request);
			const business = await dependencies.businessService.getBusiness(params.businessId);
			response.status(200).json(business);
		}) satisfies RequestHandler,

		updateBusiness: (async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<BusinessParams>(request);
			const body = getValidatedBody<Parameters<BusinessService['updateBusiness']>[1]>(request);
			const business = await dependencies.businessService.updateBusiness(params.businessId, body);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff updated a business.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'business',
				entityId: business.id
			});
			response.status(200).json(business);
		}) satisfies RequestHandler,

		bulkUpdateLabel: (async (request, response) => {
			const authContext = requireAuthContext(response);
			const body = getValidatedBody<Parameters<BusinessService['bulkUpdateLabel']>[0]>(request);
			const updatedCount = await dependencies.businessService.bulkUpdateLabel(body);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff updated business labels in bulk.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'business',
				metadata: { businessCount: updatedCount, labelId: body.labelId }
			});
			response.status(200).json({ updatedCount });
		}) satisfies RequestHandler,

		deleteBusiness: (async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<BusinessParams>(request);
			const mode = await dependencies.businessService.deleteBusiness(params.businessId);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff deleted a business.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'business',
				entityId: params.businessId,
				metadata: { mode }
			});
			response.status(200).json({ deleted: true, mode });
		}) satisfies RequestHandler,

		restoreBusiness: (async (request, response) => {
			const authContext = requireAuthContext(response);
			const params = getValidatedParams<BusinessParams>(request);
			const business = await dependencies.businessService.restoreBusiness(params.businessId);
			const requestContext = getRequestContext(request, response);
			await dependencies.logService.recordAuditLog({
				message: 'Staff restored a business.',
				actorStaffId: authContext.staffId,
				requestId: requestContext.requestId,
				method: request.method,
				path: getRequestPath(request),
				statusCode: 200,
				entityType: 'business',
				entityId: business.id
			});
			response.status(200).json(business);
		}) satisfies RequestHandler
	};
}
