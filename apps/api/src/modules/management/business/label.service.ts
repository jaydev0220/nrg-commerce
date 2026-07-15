import { AppError } from '../../../errors/app-error.js';
import type { BusinessLabelRepository } from './label.repository.js';

type BusinessLabelServiceDependencies = {
	repository: BusinessLabelRepository;
};

function ensureLabel<T>(label: T | null): T {
	if (!label) {
		throw new AppError(
			404,
			'BUSINESS_LABEL_NOT_FOUND',
			'The requested business label could not be found.'
		);
	}
	return label;
}

function normalizeName(name: string): string {
	return name.trim().toLocaleLowerCase('en-US');
}

export function createBusinessLabelService(dependencies: BusinessLabelServiceDependencies) {
	return {
		listLabels(query: Parameters<BusinessLabelRepository['listLabels']>[0]) {
			return dependencies.repository.listLabels(query);
		},

		async createLabel(input: Parameters<BusinessLabelRepository['createLabel']>[0]) {
			if (await dependencies.repository.findByNameKey(normalizeName(input.name))) {
				throw new AppError(
					409,
					'BUSINESS_LABEL_NAME_EXISTS',
					'A business label with this name already exists.'
				);
			}
			return dependencies.repository.createLabel({ ...input, nameKey: normalizeName(input.name) });
		},

		async updateLabel(
			labelId: string,
			input: Parameters<BusinessLabelRepository['updateLabel']>[1]
		) {
			const existing = ensureLabel(await dependencies.repository.findById(labelId));
			if (input.name && normalizeName(input.name) !== existing.nameKey) {
				const duplicate = await dependencies.repository.findByNameKey(normalizeName(input.name));
				if (duplicate && duplicate.id !== labelId) {
					throw new AppError(
						409,
						'BUSINESS_LABEL_NAME_EXISTS',
						'A business label with this name already exists.'
					);
				}
			}
			return dependencies.repository.updateLabel(labelId, {
				...input,
				...(input.name ? { nameKey: normalizeName(input.name) } : {})
			});
		},

		async deleteLabel(labelId: string) {
			ensureLabel(await dependencies.repository.findById(labelId));
			await dependencies.repository.softDeleteLabel(labelId);
			return 'soft-detach' as const;
		},

		async restoreLabel(labelId: string) {
			ensureLabel(await dependencies.repository.findById(labelId));
			return dependencies.repository.restoreLabel(labelId);
		}
	};
}

export type BusinessLabelService = ReturnType<typeof createBusinessLabelService>;
