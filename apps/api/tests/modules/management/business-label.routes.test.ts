import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import { errorHandler } from '../../../src/errors/error-handler.js';
import { createBusinessManagementRouter } from '../../../src/modules/management/business/business.routes.js';
import type { BusinessService } from '../../../src/modules/management/business/business.service.js';
import type { BusinessLabelService } from '../../../src/modules/management/business/label.service.js';
import type { LogService } from '../../../src/modules/management/log/log.service.js';
import { requestApp } from '../../helpers/http.js';

const labelRecord = {
	id: '0189076c-4f2a-7fe1-b9fd-2d68df455301',
	name: 'Preferred',
	color: '#2F6FED',
	discountRate: 10,
	deletedAt: null,
	createdAt: new Date('2026-07-01T00:00:00.000Z'),
	updatedAt: new Date('2026-07-01T00:00:00.000Z')
};

function createApp(labelService: BusinessLabelService) {
	const app = express();
	app.use(express.json());
	app.use((_request, response, next) => {
		response.locals['auth'] = {
			staffId: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
			permissions: ['business.read', 'business.write'],
			roles: ['admin'],
			mfa: ['authenticator'],
			primaryFactor: 'password',
			sessionId: '0189076c-4f2a-7fe1-b9fd-2d68df455112',
			staff: {}
		};
		next();
	});
	const businessService = {
		listBusinesses: async () => ({ data: [], total: 0 }),
		getBusiness: async () => null,
		createBusiness: async () => null,
		updateBusiness: async () => null,
		deleteBusiness: async () => 'soft' as const,
		restoreBusiness: async () => null
	} as unknown as BusinessService;
	const logService = {
		recordAuditLog: async () => ({})
	} as unknown as Pick<LogService, 'recordAuditLog'>;
	app.use(
		'/api/management/businesses',
		createBusinessManagementRouter({ businessService, labelService, logService })
	);
	app.use(errorHandler);
	return app;
}

test('business label routes list and create labels under the businesses module', async () => {
	let createInput: unknown;
	const labelService = {
		listLabels: async () => ({ data: [labelRecord], total: 1 }),
		createLabel: async (input: unknown) => {
			createInput = input;
			return labelRecord;
		},
		updateLabel: async () => labelRecord,
		deleteLabel: async () => 'soft-detach' as const,
		restoreLabel: async () => labelRecord
	} as unknown as BusinessLabelService;
	const app = createApp(labelService);

	const listResponse = await requestApp(app, { path: '/api/management/businesses/labels' });
	assert.equal(listResponse.status, 200, listResponse.text());
	assert.equal(listResponse.json<{ data: unknown[] }>().data.length, 1);

	const createResponse = await requestApp(app, {
		method: 'POST',
		path: '/api/management/businesses/labels',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ name: 'Preferred', color: '#2F6FED', discountRate: 10 })
	});
	assert.equal(createResponse.status, 201, createResponse.text());
	assert.deepEqual(createInput, { name: 'Preferred', color: '#2F6FED', discountRate: 10 });
});
