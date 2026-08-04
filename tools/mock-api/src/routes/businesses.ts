import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
	businessBulkLabelUpdateSchema,
	businessCreateSchema,
	businessLabelCreateSchema,
	businessLabelListQuerySchema,
	businessLabelUpdateSchema,
	businessListQuerySchema,
	businessUpdateSchema,
	countResponseSchema,
	managedBusinessLabelResponseSchema,
	managedBusinessResponseSchema,
	paginatedResponseSchema
} from '@packages/schemas';
import { conflict, notFound } from '../http/errors.js';
import { compareValues, paginate } from '../http/pagination.js';
import { parseBody, parseQuery, sendJson } from '../http/validation.js';
import type { MockState } from '../state.js';
import { assertDomainHealthy, projectBusiness } from './shared.js';

function findBusiness(state: MockState, businessId: string) {
	return state.businesses.find((business) => business.id === businessId) ?? notFound();
}

function findLabel(state: MockState, labelId: string) {
	return state.businessLabels.find((label) => label.id === labelId) ?? notFound();
}

function ensureLabel(state: MockState, labelId: string | null | undefined): void {
	if (!labelId) return;
	const label = findLabel(state, labelId);
	if (label.deletedAt) notFound('The selected business label is archived.');
}

function ensureUniqueLabelName(state: MockState, name: string, labelId?: string): void {
	const normalized = name.toLocaleLowerCase();
	if (
		state.businessLabels.some(
			(label) => label.id !== labelId && label.name.toLocaleLowerCase() === normalized
		)
	) {
		conflict('RESOURCE_CONFLICT', 'A business label with this name already exists.');
	}
}

export function createBusinessesRouter(state: MockState): Router {
	const router = Router();

	router.get('/', (request, response) => {
		assertDomainHealthy(state, 'businesses');
		const query = parseQuery(request, businessListQuerySchema);
		const search = query.search?.toLocaleLowerCase();
		let businesses = state.businesses.filter((business) => {
			if (!query.includeDeleted && business.deletedAt) return false;
			if (query.archived !== undefined && Boolean(business.deletedAt) !== query.archived)
				return false;
			if (query.labelId && business.labelId !== query.labelId) return false;
			if (!search) return true;
			return [
				business.name,
				business.contactName,
				business.contactEmail,
				business.contactPhone,
				business.taxId
			]
				.filter((value): value is string => Boolean(value))
				.some((value) => value.toLocaleLowerCase().includes(search));
		});
		businesses = [...businesses].sort((left, right) =>
			compareValues(left[query.sort], right[query.sort], query.order)
		);
		const page = paginate(businesses, query);
		sendJson(response, paginatedResponseSchema(managedBusinessResponseSchema), {
			...page,
			data: page.data.map((business) => projectBusiness(state, business))
		});
	});

	router.post('/', (request, response) => {
		assertDomainHealthy(state, 'businesses');
		const input = parseBody(request, businessCreateSchema);
		ensureLabel(state, input.labelId);
		const now = new Date();
		const business = {
			id: randomUUID(),
			name: input.name,
			contactName: input.contactName ?? null,
			contactEmail: input.contactEmail ?? null,
			contactPhone: input.contactPhone ?? null,
			taxId: input.taxId ?? null,
			address: input.address ?? null,
			notes: input.notes ?? null,
			labelId: input.labelId ?? null,
			deletedAt: null,
			createdAt: now,
			updatedAt: now
		};
		state.businesses.push(business);
		sendJson(response, managedBusinessResponseSchema, projectBusiness(state, business), 201);
	});

	router.patch('/bulk-label', (request, response) => {
		assertDomainHealthy(state, 'businesses');
		const input = parseBody(request, businessBulkLabelUpdateSchema);
		ensureLabel(state, input.labelId);
		let updatedCount = 0;
		for (const businessId of input.businessIds) {
			const business = state.businesses.find((entry) => entry.id === businessId);
			if (!business) continue;
			business.labelId = input.labelId;
			business.updatedAt = new Date();
			updatedCount += 1;
		}
		sendJson(response, countResponseSchema, { updatedCount });
	});

	router.get('/labels', (request, response) => {
		assertDomainHealthy(state, 'businesses');
		const query = parseQuery(request, businessLabelListQuerySchema);
		const search = query.search?.toLocaleLowerCase();
		const labels = state.businessLabels.filter((label) => {
			if (!query.includeDeleted && label.deletedAt) return false;
			if (search && !label.name.toLocaleLowerCase().includes(search)) return false;
			return true;
		});
		const page = paginate(labels, query);
		sendJson(response, paginatedResponseSchema(managedBusinessLabelResponseSchema), page);
	});

	router.post('/labels', (request, response) => {
		assertDomainHealthy(state, 'businesses');
		const input = parseBody(request, businessLabelCreateSchema);
		ensureUniqueLabelName(state, input.name);
		const now = new Date();
		const label = {
			id: randomUUID(),
			name: input.name,
			color: input.color,
			discountRate: input.discountRate ?? null,
			deletedAt: null,
			createdAt: now,
			updatedAt: now
		};
		state.businessLabels.push(label);
		sendJson(response, managedBusinessLabelResponseSchema, label, 201);
	});

	router.patch('/labels/:labelId', (request, response) => {
		assertDomainHealthy(state, 'businesses');
		const input = parseBody(request, businessLabelUpdateSchema);
		const label = findLabel(state, request.params['labelId'] ?? '');
		if (input.name) ensureUniqueLabelName(state, input.name, label.id);
		Object.assign(label, input, { updatedAt: new Date() });
		sendJson(response, managedBusinessLabelResponseSchema, label);
	});

	router.delete('/labels/:labelId', (request, response) => {
		assertDomainHealthy(state, 'businesses');
		const label = findLabel(state, request.params['labelId'] ?? '');
		const now = new Date();
		label.deletedAt = now;
		label.updatedAt = now;
		for (const business of state.businesses) {
			if (business.labelId === label.id) {
				business.labelId = null;
				business.updatedAt = now;
			}
		}
		response.status(204).end();
	});

	router.post('/labels/:labelId/restore', (request, response) => {
		assertDomainHealthy(state, 'businesses');
		const label = findLabel(state, request.params['labelId'] ?? '');
		label.deletedAt = null;
		label.updatedAt = new Date();
		sendJson(response, managedBusinessLabelResponseSchema, label);
	});

	router.get('/:businessId', (request, response) => {
		assertDomainHealthy(state, 'businesses');
		const business = findBusiness(state, request.params['businessId'] ?? '');
		sendJson(response, managedBusinessResponseSchema, projectBusiness(state, business));
	});

	router.patch('/:businessId', (request, response) => {
		assertDomainHealthy(state, 'businesses');
		const input = parseBody(request, businessUpdateSchema);
		const business = findBusiness(state, request.params['businessId'] ?? '');
		if (input.labelId !== undefined) ensureLabel(state, input.labelId);
		Object.assign(business, input, { updatedAt: new Date() });
		sendJson(response, managedBusinessResponseSchema, projectBusiness(state, business));
	});

	router.delete('/:businessId', (request, response) => {
		assertDomainHealthy(state, 'businesses');
		const business = findBusiness(state, request.params['businessId'] ?? '');
		business.deletedAt = new Date();
		business.updatedAt = business.deletedAt;
		response.status(204).end();
	});

	router.post('/:businessId/restore', (request, response) => {
		assertDomainHealthy(state, 'businesses');
		const business = findBusiness(state, request.params['businessId'] ?? '');
		business.deletedAt = null;
		business.updatedAt = new Date();
		sendJson(response, managedBusinessResponseSchema, projectBusiness(state, business));
	});

	return router;
}
