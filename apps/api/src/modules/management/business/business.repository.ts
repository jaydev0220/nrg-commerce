import type { DatabaseClient } from '@packages/database';

import type { PaginatedResult } from '../../../types/catalog.js';
import type { ManagedBusinessRecord } from '../../../types/management.js';

type BusinessSortField = 'name' | 'createdAt' | 'updatedAt';

type ListBusinessesInput = {
	search?: string;
	includeDeleted: boolean;
	sort: BusinessSortField;
	order: 'asc' | 'desc';
	page: number;
	limit: number;
};

type SaveBusinessInput = {
	name: string;
	contactName?: string | null;
	contactEmail?: string | null;
	contactPhone?: string | null;
	taxId?: string | null;
	address?: string | null;
	notes?: string | null;
};

function mapBusinessRecord(business: {
	id: string;
	name: string;
	contactName: string | null;
	contactEmail: string | null;
	contactPhone: string | null;
	taxId: string | null;
	address: string | null;
	notes: string | null;
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
				...(input.includeDeleted ? {} : { deletedAt: null }),
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
					: {})
			};
			const [businesses, total] = await Promise.all([
				database.business.findMany({
					where,
					orderBy: resolveOrderBy(input.sort, input.order),
					skip: (input.page - 1) * input.limit,
					take: input.limit
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
				}
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
					notes: input.notes ?? null
				}
			});

			return mapBusinessRecord(business);
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
					notes: input.notes
				}
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
				data: { deletedAt: null }
			});

			return mapBusinessRecord(business);
		}
	};
}

export type BusinessRepository = ReturnType<typeof createPrismaBusinessRepository>;
