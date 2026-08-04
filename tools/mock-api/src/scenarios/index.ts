import { defaultScenario } from './default.js';
import { e2eScenario } from './e2e.js';
import { emptyScenario } from './empty.js';
import { createErrorScenario } from './error.js';
import type { MockScenario } from './types.js';

const scenarios = [
	defaultScenario,
	emptyScenario,
	e2eScenario,
	createErrorScenario('error-products', 'products'),
	createErrorScenario('error-orders', 'orders'),
	createErrorScenario('error-businesses', 'businesses'),
	createErrorScenario('error-staff', 'staff'),
	createErrorScenario('error-logs', 'logs'),
	createErrorScenario('error-dashboard', 'dashboard'),
	createErrorScenario('error-storefront', 'storefront')
] as const;

const scenarioMap = new Map<string, MockScenario>(
	scenarios.map((scenario) => [scenario.name, scenario])
);

export const scenarioNames = scenarios.map((scenario) => scenario.name);

export function getScenario(name: string): MockScenario {
	const scenario = scenarioMap.get(name);
	if (!scenario) {
		throw new Error(`Unknown mock API scenario "${name}". Available: ${scenarioNames.join(', ')}`);
	}
	return scenario;
}
