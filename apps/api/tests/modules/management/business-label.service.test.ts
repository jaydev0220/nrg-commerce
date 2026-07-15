import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/errors/app-error.js';
import { createBusinessLabelService } from '../../../src/modules/management/business/label.service.js';

function label(
	overrides: Partial<{ id: string; name: string; nameKey: string; deletedAt: Date | null }> = {}
) {
	return {
		id: overrides.id ?? 'label-1',
		name: overrides.name ?? 'Preferred',
		nameKey: overrides.nameKey ?? 'preferred',
		color: '#2F6FED',
		discountRate: 10,
		deletedAt: overrides.deletedAt ?? null,
		createdAt: new Date('2026-07-01T00:00:00.000Z'),
		updatedAt: new Date('2026-07-01T00:00:00.000Z')
	};
}

test('business label service normalizes names and rejects case-insensitive duplicates', async () => {
	let createdNameKey = '';
	const service = createBusinessLabelService({
		repository: {
			listLabels: async () => ({ data: [], total: 0 }),
			findById: async () => null,
			findByNameKey: async (nameKey) => (nameKey === 'preferred' ? label() : null),
			createLabel: async (input) => {
				createdNameKey = input.nameKey;
				return label({ name: input.name, nameKey: input.nameKey });
			},
			updateLabel: async () => label(),
			softDeleteLabel: async () => undefined,
			restoreLabel: async () => label()
		}
	});

	await assert.rejects(
		() =>
			service.createLabel({
				name: ' Preferred ',
				nameKey: 'preferred',
				color: '#2F6FED',
				discountRate: 10
			}),
		(error: unknown) => error instanceof AppError && error.code === 'BUSINESS_LABEL_NAME_EXISTS'
	);

	const serviceWithoutDuplicate = createBusinessLabelService({
		repository: {
			listLabels: async () => ({ data: [], total: 0 }),
			findById: async () => null,
			findByNameKey: async () => null,
			createLabel: async (input) => {
				createdNameKey = input.nameKey;
				return label({ name: input.name, nameKey: input.nameKey });
			},
			updateLabel: async () => label(),
			softDeleteLabel: async () => undefined,
			restoreLabel: async () => label()
		}
	});

	await serviceWithoutDuplicate.createLabel({
		name: ' Preferred ',
		nameKey: 'preferred',
		color: '#2F6FED',
		discountRate: 10
	});
	assert.equal(createdNameKey, 'preferred');
});

test('business label service archives a label with a soft detach mode', async () => {
	let deletedId = '';
	const service = createBusinessLabelService({
		repository: {
			listLabels: async () => ({ data: [], total: 0 }),
			findById: async () => label(),
			findByNameKey: async () => null,
			createLabel: async () => label(),
			updateLabel: async () => label(),
			softDeleteLabel: async (id) => {
				deletedId = id;
			},
			restoreLabel: async () => label()
		}
	});

	assert.equal(await service.deleteLabel('label-1'), 'soft-detach');
	assert.equal(deletedId, 'label-1');
});
