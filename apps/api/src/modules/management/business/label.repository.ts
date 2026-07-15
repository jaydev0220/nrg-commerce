import type { DatabaseClient } from '@packages/database';

import type { PaginatedResult } from '../../../types/catalog.js';
import type { ManagedBusinessLabelRecord } from '../../../types/management.js';

type ListLabelsInput = {
	includeDeleted: boolean;
	search?: string;
	page: number;
	limit: number;
};

type SaveLabelInput = {
	name: string;
	nameKey?: string;
	color: string;
	discountRate?: number | null;
};

function mapLabel(label: {
	id: string;
	name: string;
	nameKey: string;
	color: string;
	discountRate: { toString(): string } | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}): ManagedBusinessLabelRecord & { nameKey: string } {
	return {
		id: label.id,
		name: label.name,
		nameKey: label.nameKey,
		color: label.color,
		discountRate: label.discountRate ? Number(label.discountRate.toString()) : null,
		deletedAt: label.deletedAt,
		createdAt: label.createdAt,
		updatedAt: label.updatedAt
	};
}

export function createPrismaBusinessLabelRepository(database: DatabaseClient) {
	return {
		async listLabels(input: ListLabelsInput): Promise<PaginatedResult<ManagedBusinessLabelRecord>> {
			const where = {
				...(input.includeDeleted ? {} : { deletedAt: null }),
				...(input.search ? { name: { contains: input.search, mode: 'insensitive' as const } } : {})
			};
			const [labels, total] = await Promise.all([
				database.businessLabel.findMany({
					where,
					orderBy: { name: 'asc' },
					skip: (input.page - 1) * input.limit,
					take: input.limit
				}),
				database.businessLabel.count({ where })
			]);
			return { data: labels.map(mapLabel), total };
		},

		async findById(labelId: string) {
			const label = await database.businessLabel.findUnique({ where: { id: labelId } });
			return label ? mapLabel(label) : null;
		},

		async findByNameKey(nameKey: string) {
			const label = await database.businessLabel.findUnique({ where: { nameKey } });
			return label ? mapLabel(label) : null;
		},

		async createLabel(input: SaveLabelInput & { nameKey: string }) {
			const label = await database.businessLabel.create({
				data: {
					name: input.name.trim(),
					nameKey: input.nameKey,
					color: input.color,
					discountRate: input.discountRate ?? null
				}
			});
			return mapLabel(label);
		},

		async updateLabel(labelId: string, input: Partial<SaveLabelInput> & { nameKey?: string }) {
			const label = await database.businessLabel.update({
				where: { id: labelId },
				data: {
					name: input.name?.trim(),
					nameKey: input.nameKey,
					color: input.color,
					discountRate: input.discountRate
				}
			});
			return mapLabel(label);
		},

		async softDeleteLabel(labelId: string): Promise<void> {
			const deletedAt = new Date();
			await database.$transaction([
				database.business.updateMany({ where: { labelId }, data: { labelId: null } }),
				database.businessLabel.update({ where: { id: labelId }, data: { deletedAt } })
			]);
		},

		async restoreLabel(labelId: string) {
			const label = await database.businessLabel.update({
				where: { id: labelId },
				data: { deletedAt: null }
			});
			return mapLabel(label);
		}
	};
}

export type BusinessLabelRepository = ReturnType<typeof createPrismaBusinessLabelRepository>;
