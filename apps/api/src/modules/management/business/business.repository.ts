import type { DatabaseClient } from '@packages/database';

import type { PaginatedResult } from '../../../types/catalog.js';
import type {
	ManagedBusinessLabelRecord,
	ManagedBusinessRecord
} from '../../../types/management.js';

type BusinessSortField = 'name' | 'createdAt' | 'updatedAt';

type ListBusinessesInput = {
	search?: string;
	includeDeleted: boolean;
	archived?: boolean;
	sort: BusinessSortField;
	order: 'asc' | 'desc';
	page: number;
	limit: number;
	labelId?: string;
};

type SaveBusinessInput = {
	name: string;
	contactName?: string | null;
	contactEmail?: string | null;
	contactPhone?: string | null;
	taxId?: string | null;
	address?: string | null;
	notes?: string | null;
	labelId?: string | null;
};

type BulkLabelUpdateInput = {
	businessIds: string[];
	labelId: string | null;
};

function mapLabel(
	label: {
		id: string;
		name: string;
		color: string;
		discountRate: { toString(): string } | null;
		deletedAt: Date | null;
		createdAt: Date;
		updatedAt: Date;
	} | null
): ManagedBusinessLabelRecord | null {
	return label
		? {
				id: label.id,
				name: label.name,
				color: label.color,
				discountRate: label.discountRate ? Number(label.discountRate.toString()) : null,
				deletedAt: label.deletedAt,
				createdAt: label.createdAt,
				updatedAt: label.updatedAt
			}
		: null;
}

function mapBusinessRecord(business: {
	id: string;
	name: string;
	contactName: string | null;
	contactEmail: string | null;
	contactPhone: string | null;
	taxId: string | null;
	address: string | null;
	notes: string | null;
	labelId: string | null;
	label: {
		id: string;
		name: string;
		color: string;
		discountRate: { toString(): string } | null;
		deletedAt: Date | null;
		createdAt: Date;
		updatedAt: Date;
	} | null;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}): ManagedBusinessRecord {
	return {
		id: business.id,
		name: business.name,
		contactName: business.contactName,
		contactEmail: business.contactEmail,
		contactPhone: business.contactPhone,
		taxId: business.taxId,
		address: business.address,
		notes: business.notes,
		labelId: business.labelId,
		label: mapLabel(business.label),
		deletedAt: business.deletedAt,
		createdAt: business.createdAt,
		updatedAt: business.updatedAt
	};
}

function resolveOrderBy(sort: BusinessSortField, order: 'asc' | 'desc') {
	switch (sort) {
		case 'name':
			return { name: order } as const;
		case 'updatedAt':
			return { updatedAt: order } as const;
		case 'createdAt':
		default:
			return { createdAt: order } as const;
	}
}

export function createPrismaBusinessRepository(database: DatabaseClient) {
	return {
		async listBusinesses(
			input: ListBusinessesInput
		): Promise<PaginatedResult<ManagedBusinessRecord>> {
			const where = {
				...(input.archived === true
					? { deletedAt: { not: null } }
					: input.archived === false || !input.includeDeleted
						? { deletedAt: null }
						: {}),
				...(input.search
					? {
							OR: [
								{ name: { contains: input.search, mode: 'insensitive' as const } },
								{ contactName: { contains: input.search, mode: 'insensitive' as const } },
								{ contactEmail: { contains: input.search, mode: 'insensitive' as const } },
								{ contactPhone: { contains: input.search, mode: 'insensitive' as const } },
								{ taxId: { contains: input.search, mode: 'insensitive' as const } }
							]
						}
					: {}),
				...(input.labelId ? { labelId: input.labelId } : {})
			};
			const [businesses, total] = await Promise.all([
				database.business.findMany({
					where,
					orderBy: resolveOrderBy(input.sort, input.order),
					skip: (input.page - 1) * input.limit,
					take: input.limit,
					include: { label: true }
				}),
				database.business.count({ where })
			]);

			return {
				data: businesses.map(mapBusinessRecord),
				total
			};
		},

		async findById(
			businessId: string,
			includeDeleted = true
		): Promise<ManagedBusinessRecord | null> {
			const business = await database.business.findFirst({
				where: {
					id: businessId,
					...(includeDeleted ? {} : { deletedAt: null })
				},
				include: { label: true }
			});

			return business ? mapBusinessRecord(business) : null;
		},

		async createBusiness(input: SaveBusinessInput): Promise<ManagedBusinessRecord> {
			const business = await database.business.create({
				data: {
					name: input.name,
					contactName: input.contactName ?? null,
					contactEmail: input.contactEmail ?? null,
					contactPhone: input.contactPhone ?? null,
					taxId: input.taxId ?? null,
					address: input.address ?? null,
					notes: input.notes ?? null,
					labelId: input.labelId ?? null
				},
				include: { label: true }
			});

			return mapBusinessRecord(business);
		},

		async activeLabelExists(labelId: string): Promise<boolean> {
			const label = await database.businessLabel.findFirst({
				where: { id: labelId, deletedAt: null },
				select: { id: true }
			});
			return Boolean(label);
		},

		async updateBusiness(
			businessId: string,
			input: Partial<SaveBusinessInput>
		): Promise<ManagedBusinessRecord> {
			const business = await database.business.update({
				where: { id: businessId },
				data: {
					name: input.name,
					contactName: input.contactName,
					contactEmail: input.contactEmail,
					contactPhone: input.contactPhone,
					taxId: input.taxId,
					address: input.address,
					notes: input.notes,
					labelId: input.labelId
				},
				include: { label: true }
			});

			return mapBusinessRecord(business);
		},

		async softDeleteBusiness(businessId: string): Promise<void> {
			await database.business.update({
				where: { id: businessId },
				data: { deletedAt: new Date() }
			});
		},

		async restoreBusiness(businessId: string): Promise<ManagedBusinessRecord> {
			const business = await database.business.update({
				where: { id: businessId },
				data: { deletedAt: null },
				include: { label: true }
			});

			return mapBusinessRecord(business);
		},

		async bulkUpdateLabel(
			input: BulkLabelUpdateInput
		): Promise<{ updatedCount: number; missingBusinessIds: string[]; labelExists: boolean }> {
			return database.$transaction(async (transaction) => {
				const businesses = await transaction.business.findMany({
					where: { id: { in: input.businessIds }, deletedAt: null },
					select: { id: true }
				});
				const businessIds = new Set(businesses.map((business) => business.id));
				const missingBusinessIds = input.businessIds.filter((id) => !businessIds.has(id));
				const labelExists = input.labelId
					? Boolean(
							await transaction.businessLabel.findFirst({
								where: { id: input.labelId, deletedAt: null },
								select: { id: true }
							})
						)
					: true;

				if (missingBusinessIds.length > 0 || !labelExists) {
					return { updatedCount: 0, missingBusinessIds, labelExists };
				}

				const result = await transaction.business.updateMany({
					where: { id: { in: input.businessIds }, deletedAt: null },
					data: { labelId: input.labelId }
				});

				return { updatedCount: result.count, missingBusinessIds, labelExists };
			});
		}
	};
}

export type BusinessRepository = ReturnType<typeof createPrismaBusinessRepository>;
