import { createEmptyState } from '../fixtures/index.js';
import type { MockScenario } from './types.js';

export const emptyScenario: MockScenario = {
	name: 'empty',
	createState: () => createEmptyState()
};
