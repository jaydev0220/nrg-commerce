import { Router } from 'express';
import {
	managedLogResponseSchema,
	managementLogListQuerySchema,
	paginatedResponseSchema
} from '@packages/schemas';
import { notFound } from '../http/errors.js';
import { compareValues, paginate } from '../http/pagination.js';
import { parseQuery, sendJson } from '../http/validation.js';
import type { MockState } from '../state.js';
import { assertDomainHealthy } from './shared.js';

export function createLogsRouter(state: MockState): Router {
	const router = Router();

	router.get('/', (request, response) => {
		assertDomainHealthy(state, 'logs');
		const query = parseQuery(request, managementLogListQuerySchema);
		let logs = state.logs.filter((log) => {
			if (query.kind && log.kind !== query.kind) return false;
			if (query.level && log.level !== query.level) return false;
			if (query.actorStaffId && log.actorStaffId !== query.actorStaffId) return false;
			if (query.requestId && log.requestId !== query.requestId) return false;
			return true;
		});
		logs = [...logs].sort((left, right) =>
			compareValues(left[query.sort], right[query.sort], query.order)
		);
		const page = paginate(logs, query);
		sendJson(response, paginatedResponseSchema(managedLogResponseSchema), page);
	});

	router.get('/:logId', (request, response) => {
		assertDomainHealthy(state, 'logs');
		const log = state.logs.find((entry) => entry.id === request.params['logId']) ?? notFound();
		sendJson(response, managedLogResponseSchema, log);
	});

	return router;
}
