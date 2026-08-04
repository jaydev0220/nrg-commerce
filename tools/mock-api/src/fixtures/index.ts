import type { FailureDomain, MockState } from '../state.js';
import {
	createAuthSessionFixtures,
	createLogFixtures,
	createPasskeyFixtures,
	createRoleFixtures,
	createStaffFixtures
} from './auth.js';
import {
	createBusinessFixtures,
	createBusinessLabelFixtures,
	createOrderFixtures
} from './businesses.js';
import { ids } from './ids.js';
import {
	createCategoryFixtures,
	createImageFixtures,
	createProductFixtures,
	createSkuFixtures
} from './products.js';

export function createDefaultState(failureDomains: Iterable<FailureDomain> = []): MockState {
	const roles = createRoleFixtures();
	return {
		categories: createCategoryFixtures(),
		products: createProductFixtures(),
		skus: createSkuFixtures(),
		images: createImageFixtures(),
		imageUploads: new Map(),
		businessLabels: createBusinessLabelFixtures(),
		businesses: createBusinessFixtures(),
		orders: createOrderFixtures(),
		roles,
		staff: createStaffFixtures(roles),
		logs: createLogFixtures(),
		authSessions: createAuthSessionFixtures(),
		passkeys: createPasskeyFixtures(),
		currentStaffId: ids.staffAdmin,
		currentSessionId: ids.sessionCurrent,
		failureDomains: new Set(failureDomains)
	};
}

export function createEmptyState(): MockState {
	const state = createDefaultState();
	return {
		...state,
		categories: [],
		products: [],
		skus: [],
		images: [],
		businessLabels: [],
		businesses: [],
		orders: [],
		logs: [],
		staff: state.staff.filter((entry) => entry.id === state.currentStaffId)
	};
}
