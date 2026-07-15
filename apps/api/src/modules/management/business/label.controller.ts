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
import type { BusinessLabelService } from './label.service.js';

type LabelControllerDependencies = {
	labelService: BusinessLabelService;
	logService: Pick<LogService, 'recordAuditLog'>;
};

export function createBusinessLabelController(dependencies: LabelControllerDependencies) {
	const audit = async (
		request: Parameters<RequestHandler>[0],
		response: Parameters<RequestHandler>[1],
		message: string,
		entityId: string,
		statusCode: number
	) => {
		const context = getRequestContext(request, response);
		await dependencies.logService.recordAuditLog({
			message,
			actorStaffId: requireAuthContext(response).staffId,
			requestId: context.requestId,
			method: request.method,
			path: getRequestPath(request),
			statusCode,
			entityType: 'business_label',
			entityId
		});
	};

	return {
		list: (async (request, response) => {
			const query = getValidatedQuery<Parameters<BusinessLabelService['listLabels']>[0]>(request);
			const result = await dependencies.labelService.listLabels(query);
			response.status(200).json(
				buildPaginatedResponse(result.data, {
					page: query.page,
					limit: query.limit,
					total: result.total
				})
			);
		}) satisfies RequestHandler,
		create: (async (request, response) => {
			const label = await dependencies.labelService.createLabel(getValidatedBody(request));
			await audit(request, response, 'Staff created a business label.', label.id, 201);
			response.status(201).json(label);
		}) satisfies RequestHandler,
		update: (async (request, response) => {
			const { labelId } = getValidatedParams<{ labelId: string }>(request);
			const label = await dependencies.labelService.updateLabel(labelId, getValidatedBody(request));
			await audit(request, response, 'Staff updated a business label.', label.id, 200);
			response.status(200).json(label);
		}) satisfies RequestHandler,
		remove: (async (request, response) => {
			const { labelId } = getValidatedParams<{ labelId: string }>(request);
			const mode = await dependencies.labelService.deleteLabel(labelId);
			await audit(request, response, 'Staff archived a business label.', labelId, 200);
			response.status(200).json({ deleted: true, mode });
		}) satisfies RequestHandler,
		restore: (async (request, response) => {
			const { labelId } = getValidatedParams<{ labelId: string }>(request);
			const label = await dependencies.labelService.restoreLabel(labelId);
			await audit(request, response, 'Staff restored a business label.', label.id, 200);
			response.status(200).json(label);
		}) satisfies RequestHandler
	};
}
