import { createDefaultState } from '../fixtures/index.js';
import type { MockScenario } from './types.js';

export const defaultScenario: MockScenario = {
	name: 'default',
	createState: () => createDefaultState()
};
