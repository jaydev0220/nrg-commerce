import { createDefaultState } from '../fixtures/index.js';
import { ids } from '../fixtures/ids.js';
import type { MockScenario } from './types.js';

export const e2eScenario: MockScenario = {
	name: 'e2e',
	createState() {
		const state = createDefaultState();
		const beaker250 = state.skus.find((sku) => sku.id === ids.skuBeaker250);
		if (beaker250) beaker250.stockQuantity = 8;
		return state;
	}
};
