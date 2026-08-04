import type { MockState } from '../state.js';

export type MockScenario = {
	name: string;
	createState(): MockState;
};
