import type { DatabaseClient, OrderStatus, Prisma } from '@packages/database';

import { AppError } from '../../../errors/app-error.js';
import type { PaginatedResult } from '../../../types/catalog.js';
import type {
	ManagedBusinessRecord,
	ManagedOrderItemRecord,
	ManagedOrderRecord,
	ManagedOrderSkuLookupRecord
} from '../../../types/management.js';
import { aggregateSkuQuantities, resolveInventoryAdjustment } from './order.inventory.js';

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
	idempotencyKey: string;
	idempotencyFingerprint: string;
	businessId?: string | null;
	customerName?: string | null;
	customerEmail?: string | null;
	customerPhone?: string | null;
	customerAddress?: string | null;
	itemCount: number;
	subtotalAmount: number;
	discountLabelId: string | null;
	discountLabelName: string | null;
	suggestedDiscountRate: number | null;
	discountRate: number;
	discountAmount: number;
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

type OrderSkuLookupInput = {
	search?: string;
	page: number;
	limit: number;
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
		labelId: business.labelId,
		label: business.label
			? {
					id: business.label.id,
					name: business.label.name,
					color: business.label.color,
					discountRate: business.label.discountRate
						? Number(business.label.discountRate.toString())
						: null,
					deletedAt: business.label.deletedAt,
					createdAt: business.label.createdAt,
					updatedAt: business.label.updatedAt
				}
			: null,
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
	subtotalAmount: { toString(): string };
	discountLabelId: string | null;
	discountLabelName: string | null;
	suggestedDiscountRate: { toString(): string } | null;
	discountRate: { toString(): string };
	discountAmount: { toString(): string };
	totalAmount: { toString(): string };
	completedAt: Date | null;
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
		subtotalAmount: Number(order.subtotalAmount.toString()),
		discountLabelId: order.discountLabelId,
		discountLabelName: order.discountLabelName,
		suggestedDiscountRate: order.suggestedDiscountRate
			? Number(order.suggestedDiscountRate.toString())
			: null,
		discountRate: Number(order.discountRate.toString()),
		discountAmount: Number(order.discountAmount.toString()),
		totalAmount: Number(order.totalAmount.toString()),
		completedAt: order.completedAt,
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
	const adjustInventory = async (
		transaction: Prisma.TransactionClient,
		items: Array<{ productSkuId?: string | null; quantity: number }>,
		direction: 'deduct' | 'restore'
	) => {
		for (const [productSkuId, quantity] of aggregateSkuQuantities(items)) {
			if (direction === 'deduct') {
				const result = await transaction.productSku.updateMany({
					where: { id: productSkuId, deletedAt: null, stockQuantity: { gte: quantity } },
					data: { stockQuantity: { decrement: quantity } }
				});
				if (result.count !== 1) {
					throw new AppError(409, 'INSUFFICIENT_STOCK', 'Insufficient stock for this order.');
				}
			} else {
				await transaction.productSku.updateMany({
					where: { id: productSkuId },
					data: { stockQuantity: { increment: quantity } }
				});
			}

			await transaction.product.updateMany({
				where: { skus: { some: { id: productSkuId } } },
				data: { updatedAt: new Date() }
			});
		}
	};

	const adjustInventoryForStatusTransition = async (
		transaction: Prisma.TransactionClient,
		currentStatus: OrderStatus,
		nextStatus: OrderStatus,
		items: Array<{ productSkuId: string | null; quantity: number }>
	) => {
		const direction = resolveInventoryAdjustment(currentStatus, nextStatus);
		if (direction) await adjustInventory(transaction, items, direction);
	};

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
						business: { include: { label: true } },
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
					business: { include: { label: true } },
					items: {
						orderBy: [{ createdAt: 'asc' }]
					}
				}
			});

			return order ? mapOrder(order) : null;
		},

		async findOrderByIdempotencyKey(idempotencyKey: string) {
			const order = await database.order.findUnique({
				where: { idempotencyKey },
				include: {
					business: { include: { label: true } },
					items: { orderBy: [{ createdAt: 'asc' }] }
				}
			});

			return order ? { order: mapOrder(order), fingerprint: order.idempotencyFingerprint } : null;
		},

		async findBusinessById(businessId: string): Promise<ManagedBusinessRecord | null> {
			const business = await database.business.findFirst({
				where: {
					id: businessId,
					deletedAt: null
				},
				include: { label: true }
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

		async listOrderSkuLookups(
			input: OrderSkuLookupInput
		): Promise<PaginatedResult<ManagedOrderSkuLookupRecord>> {
			const where = {
				deletedAt: null,
				product: {
					is: {
						deletedAt: null
					}
				},
				...(input.search
					? {
							OR: [
								{ skuCode: { contains: input.search, mode: 'insensitive' as const } },
								{
									product: {
										is: { name: { contains: input.search, mode: 'insensitive' as const } }
									}
								},
								{
									product: {
										is: { nameEn: { contains: input.search, mode: 'insensitive' as const } }
									}
								}
							]
						}
					: {})
			};
			const [skus, total] = await Promise.all([
				database.productSku.findMany({
					where,
					orderBy: { skuCode: 'asc' },
					skip: (input.page - 1) * input.limit,
					take: input.limit,
					select: {
						id: true,
						skuCode: true,
						price: true,
						attributes: true,
						product: { select: { name: true } }
					}
				}),
				database.productSku.count({ where })
			]);

			return {
				data: skus.map((sku) => ({
					id: sku.id,
					skuCode: sku.skuCode,
					productName: sku.product.name,
					price: Number(sku.price.toString()),
					attributes: sku.attributes
				})),
				total
			};
		},

		async createOrder(input: CreateOrderInput): Promise<ManagedOrderRecord> {
			const order = await database.$transaction(async (transaction) => {
				await adjustInventory(transaction, input.items, 'deduct');
				return transaction.order.create({
					data: {
						idempotencyKey: input.idempotencyKey,
						idempotencyFingerprint: input.idempotencyFingerprint,
						businessId: input.businessId ?? null,
						customerName: input.customerName ?? null,
						customerEmail: input.customerEmail ?? null,
						customerPhone: input.customerPhone ?? null,
						customerAddress: input.customerAddress ?? null,
						itemCount: input.itemCount,
						subtotalAmount: input.subtotalAmount,
						discountLabelId: input.discountLabelId,
						discountLabelName: input.discountLabelName,
						suggestedDiscountRate: input.suggestedDiscountRate,
						discountRate: input.discountRate,
						discountAmount: input.discountAmount,
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
						business: { include: { label: true } },
						items: {
							orderBy: [{ createdAt: 'asc' }]
						}
					}
				});
			});

			return mapOrder(order);
		},

		async updateOrderStatus(
			orderId: string,
			status: OrderStatus,
			completedAt: Date | null
		): Promise<ManagedOrderRecord> {
			const order = await database.$transaction(async (transaction) => {
				const current = await transaction.order.findUniqueOrThrow({
					where: { id: orderId },
					select: { status: true, items: { select: { productSkuId: true, quantity: true } } }
				});
				await adjustInventoryForStatusTransition(
					transaction,
					current.status,
					status,
					current.items
				);
				return transaction.order.update({
					where: { id: orderId },
					data: { status, completedAt },
					include: {
						business: { include: { label: true } },
						items: {
							orderBy: [{ createdAt: 'asc' }]
						}
					}
				});
			});

			return mapOrder(order);
		},

		async updateOrder(
			orderId: string,
			input: {
				status?: OrderStatus;
				completedAt?: Date | null;
				businessId?: string | null;
				customerName?: string | null;
				customerEmail?: string | null;
				customerPhone?: string | null;
				customerAddress?: string | null;
			}
		): Promise<ManagedOrderRecord> {
			const order = await database.$transaction(async (transaction) => {
				if (input.status !== undefined) {
					const current = await transaction.order.findUniqueOrThrow({
						where: { id: orderId },
						select: { status: true, items: { select: { productSkuId: true, quantity: true } } }
					});
					await adjustInventoryForStatusTransition(
						transaction,
						current.status,
						input.status,
						current.items
					);
				}
				return transaction.order.update({
					where: { id: orderId },
					data: input,
					include: {
						business: { include: { label: true } },
						items: { orderBy: [{ createdAt: 'asc' }] }
					}
				});
			});
			return mapOrder(order);
		}
	};
}

export type OrderRepository = ReturnType<typeof createPrismaOrderRepository>;
