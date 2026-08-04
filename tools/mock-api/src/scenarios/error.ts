import { createDefaultState } from '../fixtures/index.js';
import type { FailureDomain } from '../state.js';
import type { MockScenario } from './types.js';

export function createErrorScenario(name: string, domain: FailureDomain): MockScenario {
	return {
		name,
		createState: () => createDefaultState([domain])
	};
}
