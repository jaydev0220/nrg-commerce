import type { DatabaseClient, OrderStatus, Prisma } from '@packages/database';

import type { PaginatedResult } from '../../../types/catalog.js';
import type {
	ManagedBusinessRecord,
	ManagedOrderItemRecord,
	ManagedOrderRecord
} from '../../../types/management.js';

type OrderSortField = 'createdAt' | 'totalAmount';

type ListOrdersInput = {
	search?: string;
	status?: OrderStatus;
	businessId?: string;
	sort: OrderSortField;
	order: 'asc' | 'desc';
	page: number;
	limit: number;
};

type CreateOrderInput = {
	businessId?: string;
	customerName?: string;
	customerEmail?: string;
	customerPhone?: string;
	customerAddress?: string;
	itemCount: number;
	totalAmount: number;
	items: Array<{
		productSkuId?: string;
		skuCode: string;
		productName: string;
		unitPrice: number;
		quantity: number;
		lineTotal: number;
		attributes: Prisma.InputJsonValue;
	}>;
};

type ProductSkuLookup = {
	id: string;
};

function mapBusiness(
	business: {
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
	} | null
): ManagedBusinessRecord | null {
	if (!business) {
		return null;
	}

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

function mapOrderItem(item: {
	id: string;
	orderId: string;
	productSkuId: string | null;
	skuCode: string;
	productName: string;
	unitPrice: { toString(): string };
	quantity: number;
	lineTotal: { toString(): string };
	attributes: Prisma.JsonValue;
	createdAt: Date;
}): ManagedOrderItemRecord {
	return {
		id: item.id,
		orderId: item.orderId,
		productSkuId: item.productSkuId,
		skuCode: item.skuCode,
		productName: item.productName,
		unitPrice: Number(item.unitPrice.toString()),
		quantity: item.quantity,
		lineTotal: Number(item.lineTotal.toString()),
		attributes: item.attributes,
		createdAt: item.createdAt
	};
}

function mapOrder(order: {
	id: string;
	businessId: string | null;
	status: OrderStatus;
	customerName: string | null;
	customerEmail: string | null;
	customerPhone: string | null;
	customerAddress: string | null;
	itemCount: number;
	totalAmount: { toString(): string };
	createdAt: Date;
	updatedAt: Date;
	business: {
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
	} | null;
	items?: Array<{
		id: string;
		orderId: string;
		productSkuId: string | null;
		skuCode: string;
		productName: string;
		unitPrice: { toString(): string };
		quantity: number;
		lineTotal: { toString(): string };
		attributes: Prisma.JsonValue;
		createdAt: Date;
	}>;
}): ManagedOrderRecord {
	return {
		id: order.id,
		businessId: order.businessId,
		status: order.status,
		customerName: order.customerName,
		customerEmail: order.customerEmail,
		customerPhone: order.customerPhone,
		customerAddress: order.customerAddress,
		itemCount: order.itemCount,
		totalAmount: Number(order.totalAmount.toString()),
		createdAt: order.createdAt,
		updatedAt: order.updatedAt,
		business: mapBusiness(order.business),
		items: order.items?.map(mapOrderItem) ?? []
	};
}

function resolveOrderBy(sort: OrderSortField, order: 'asc' | 'desc') {
	switch (sort) {
		case 'totalAmount':
			return { totalAmount: order } as const;
		case 'createdAt':
		default:
			return { createdAt: order } as const;
	}
}

export function createPrismaOrderRepository(database: DatabaseClient) {
	return {
		async listOrders(input: ListOrdersInput): Promise<PaginatedResult<ManagedOrderRecord>> {
			const where = {
				...(input.status ? { status: input.status } : {}),
				...(input.businessId ? { businessId: input.businessId } : {}),
				...(input.search
					? {
							OR: [
								{ id: { contains: input.search, mode: 'insensitive' as const } },
								{ customerName: { contains: input.search, mode: 'insensitive' as const } },
								{ customerEmail: { contains: input.search, mode: 'insensitive' as const } },
								{
									business: {
										is: { name: { contains: input.search, mode: 'insensitive' as const } }
									}
								}
							]
						}
					: {})
			};
			const [orders, total] = await Promise.all([
				database.order.findMany({
					where,
					orderBy: resolveOrderBy(input.sort, input.order),
					skip: (input.page - 1) * input.limit,
					take: input.limit,
					include: {
						business: true,
						items: {
							orderBy: [{ createdAt: 'asc' }]
						}
					}
				}),
				database.order.count({ where })
			]);

			return {
				data: orders.map(mapOrder),
				total
			};
		},

		async findOrderById(orderId: string): Promise<ManagedOrderRecord | null> {
			const order = await database.order.findUnique({
				where: { id: orderId },
				include: {
					business: true,
					items: {
						orderBy: [{ createdAt: 'asc' }]
					}
				}
			});

			return order ? mapOrder(order) : null;
		},

		async findBusinessById(businessId: string): Promise<ManagedBusinessRecord | null> {
			const business = await database.business.findFirst({
				where: {
					id: businessId,
					deletedAt: null
				}
			});

			return mapBusiness(business);
		},

		async findSkuById(productSkuId: string): Promise<ProductSkuLookup | null> {
			const sku = await database.productSku.findFirst({
				where: {
					id: productSkuId,
					deletedAt: null,
					product: {
						is: {
							deletedAt: null
						}
					}
				},
				select: {
					id: true
				}
			});

			return sku;
		},

		async createOrder(input: CreateOrderInput): Promise<ManagedOrderRecord> {
			const order = await database.order.create({
				data: {
					businessId: input.businessId ?? null,
					customerName: input.customerName ?? null,
					customerEmail: input.customerEmail ?? null,
					customerPhone: input.customerPhone ?? null,
					customerAddress: input.customerAddress ?? null,
					itemCount: input.itemCount,
					totalAmount: input.totalAmount,
					items: {
						create: input.items.map((item) => ({
							productSkuId: item.productSkuId ?? null,
							skuCode: item.skuCode,
							productName: item.productName,
							unitPrice: item.unitPrice,
							quantity: item.quantity,
							lineTotal: item.lineTotal,
							attributes: item.attributes
						}))
					}
				},
				include: {
					business: true,
					items: {
						orderBy: [{ createdAt: 'asc' }]
					}
				}
			});

			return mapOrder(order);
		},

		async updateOrderStatus(orderId: string, status: OrderStatus): Promise<ManagedOrderRecord> {
			const order = await database.order.update({
				where: { id: orderId },
				data: { status },
				include: {
					business: true,
					items: {
						orderBy: [{ createdAt: 'asc' }]
					}
				}
			});

			return mapOrder(order);
		}
	};
}

export type OrderRepository = ReturnType<typeof createPrismaOrderRepository>;
