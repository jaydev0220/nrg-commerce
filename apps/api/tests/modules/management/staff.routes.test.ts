import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import { errorHandler } from '../../../src/errors/error-handler.js';
import { createStaffManagementRouter } from '../../../src/modules/management/staff/staff.routes.js';
import type { StaffService } from '../../../src/modules/management/staff/staff.service.js';
import type { LogService } from '../../../src/modules/management/log/log.service.js';
import { requestApp } from '../../helpers/http.js';

test('management staff routes do not expose administrator-selected passwords', async () => {
	const app = express();

	app.use(express.json());
	app.use((_request, response, next) => {
		response.locals['auth'] = {
			staffId: '0189076c-4f2a-7fe1-b9fd-2d68df455111',
			sessionId: '0189076c-4f2a-7fe1-b9fd-2d68df455112',
			roles: ['admin'],
			permissions: ['staff.update'],
			mfa: ['authenticator'],
			primaryFactor: 'password'
		};
		next();
	});
	app.use(
		'/api/management/staff',
		createStaffManagementRouter({
			staffService: {} as StaffService,
			logService: {} as Pick<LogService, 'recordAuditLog'>
		})
	);
	app.use((_request, response) => response.status(404).send());
	app.use(errorHandler);

	const response = await requestApp(app, {
		method: 'PATCH',
		path: '/api/management/staff/0189076c-4f2a-7fe1-b9fd-2d68df455222/password',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ password: 'Administrator-Chosen-Password-1!' })
	});

	assert.equal(response.status, 404);
});
