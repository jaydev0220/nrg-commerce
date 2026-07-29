import type { DatabaseClient, OrderStatus, Prisma } from '@packages/database';

import { AppError } from '../../../errors/app-error.js';
import type { PaginatedResult } from '../../../types/catalog.js';
import type {
	ManagedBusinessRecord,
	ManagedOrderItemRecord,
	ManagedOrderPreviewItemRecord,
	ManagedOrderRecord,
	ManagedOrderSkuLookupRecord,
	ManagedOrderUpdatePreviewRecord
} from '../../../types/management.js';
import { aggregateSkuQuantities, isOrderStatusTransitionAllowed } from './order.inventory.js';
import {
	buildOrderUpdatePreview,
	catalogSnapshotsEqual,
	isCatalogOrderUpdateItem,
	type OrderUpdateInput,
	type ResolvedOrderUpdateItem
} from './order.update.js';

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
	skuCode: string;
	productName: string;
	price: number;
	attributes: Prisma.InputJsonValue;
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
	version: number;
	completedAt: Date | null;
	cancelledAt: Date | null;
	refundedAt: Date | null;
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
		version: order.version,
		completedAt: order.completedAt,
		cancelledAt: order.cancelledAt,
		refundedAt: order.refundedAt,
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

	type InternalOrderUpdateInput = Omit<OrderUpdateInput, 'version'> & { version?: number };

	const assertConsumerContact = (input: {
		businessId: string | null;
		customerName: string | null;
		customerPhone: string | null;
	}) => {
		if (input.businessId || (input.customerName?.trim() && input.customerPhone?.trim())) {
			return;
		}
		throw new AppError(
			400,
			'CUSTOMER_CONTACT_REQUIRED',
			'Customer name and phone are required for consumer orders.'
		);
	};

	const resolveUpdateItems = async (
		transaction: Prisma.TransactionClient,
		current: ManagedOrderRecord,
		inputItems: OrderUpdateInput['items']
	): Promise<ResolvedOrderUpdateItem[]> => {
		if (!inputItems) {
			return current.items.map((item) => ({
				id: item.id,
				productSkuId: item.productSkuId,
				skuCode: item.skuCode,
				productName: item.productName,
				unitPrice: item.unitPrice,
				quantity: item.quantity,
				attributes: item.attributes
			}));
		}

		const currentById = new Map(current.items.map((item) => [item.id, item]));
		const requestedSkuIds = [
			...new Set(inputItems.filter(isCatalogOrderUpdateItem).map((item) => item.productSkuId))
		];
		const catalogSkus = await transaction.productSku.findMany({
			where: {
				id: { in: requestedSkuIds },
				deletedAt: null,
				product: { is: { deletedAt: null } }
			},
			select: {
				id: true,
				skuCode: true,
				price: true,
				attributes: true,
				product: { select: { name: true } }
			}
		});
		const catalogById = new Map(catalogSkus.map((sku) => [sku.id, sku]));
		const seenItemIds = new Set<string>();
		const seenSkuIds = new Set<string>();
		const seenSkuCodes = new Set<string>();
		const resolvedItems: ResolvedOrderUpdateItem[] = [];

		for (const inputItem of inputItems) {
			const existing = inputItem.id ? currentById.get(inputItem.id) : undefined;
			if (inputItem.id && !existing) {
				throw new AppError(
					400,
					'ORDER_ITEM_NOT_FOUND',
					'One or more order items do not belong to this order.'
				);
			}
			if (inputItem.id && seenItemIds.has(inputItem.id)) {
				throw new AppError(400, 'DUPLICATE_ORDER_ITEM', 'An order item may only appear once.');
			}
			if (inputItem.id) seenItemIds.add(inputItem.id);

			let resolved: ResolvedOrderUpdateItem;
			if (isCatalogOrderUpdateItem(inputItem)) {
				if (seenSkuIds.has(inputItem.productSkuId)) {
					throw new AppError(
						400,
						'DUPLICATE_ORDER_ITEM',
						'A catalog SKU may only appear once in an order.'
					);
				}
				seenSkuIds.add(inputItem.productSkuId);

				const catalogSku = catalogById.get(inputItem.productSkuId);
				const actualSnapshot = catalogSku
					? {
							skuCode: catalogSku.skuCode,
							productName: catalogSku.product.name,
							unitPrice: Number(catalogSku.price.toString()),
							attributes: catalogSku.attributes as Prisma.JsonValue
						}
					: existing?.productSkuId === inputItem.productSkuId
						? {
								skuCode: existing.skuCode,
								productName: existing.productName,
								unitPrice: existing.unitPrice,
								attributes: existing.attributes
							}
						: null;
				if (!actualSnapshot) {
					throw new AppError(
						404,
						'PRODUCT_SKU_NOT_FOUND',
						'One or more referenced product SKUs could not be found.'
					);
				}
				if (!catalogSnapshotsEqual(inputItem.expectedSnapshot, actualSnapshot)) {
					throw new AppError(
						409,
						'ORDER_CATALOG_SNAPSHOT_CHANGED',
						'A referenced product SKU changed while this order was being edited.'
					);
				}
				resolved = {
					id: inputItem.id ?? null,
					productSkuId: inputItem.productSkuId,
					skuCode: actualSnapshot.skuCode,
					productName: actualSnapshot.productName,
					unitPrice: actualSnapshot.unitPrice,
					quantity: inputItem.quantity,
					attributes: actualSnapshot.attributes
				};
			} else {
				resolved = {
					id: inputItem.id ?? null,
					productSkuId: null,
					skuCode: inputItem.skuCode,
					productName: inputItem.productName,
					unitPrice: inputItem.unitPrice,
					quantity: inputItem.quantity,
					attributes:
						inputItem.attributes ?? (existing?.productSkuId === null ? existing.attributes : {})
				};
			}

			const normalizedSkuCode = resolved.skuCode.toLowerCase();
			if (seenSkuCodes.has(normalizedSkuCode)) {
				throw new AppError(
					400,
					'DUPLICATE_ORDER_ITEM',
					'An SKU code may only appear once in an order.'
				);
			}
			seenSkuCodes.add(normalizedSkuCode);
			resolvedItems.push(resolved);
		}

		return resolvedItems;
	};

	const assertInventoryAvailable = async (
		transaction: Prisma.TransactionClient,
		preview: ManagedOrderUpdatePreviewRecord
	) => {
		for (const change of preview.changes.inventory) {
			if (change.stockDelta >= 0) continue;
			const sku = await transaction.productSku.findUnique({
				where: { id: change.productSkuId },
				select: { stockQuantity: true }
			});
			if (!sku || sku.stockQuantity < -change.stockDelta) {
				throw new AppError(409, 'INSUFFICIENT_STOCK', 'Insufficient stock for this order.');
			}
		}
	};

	const applyInventoryChanges = async (
		transaction: Prisma.TransactionClient,
		changes: ManagedOrderUpdatePreviewRecord['changes']['inventory']
	) => {
		for (const change of changes) {
			const result =
				change.stockDelta < 0
					? await transaction.productSku.updateMany({
							where: {
								id: change.productSkuId,
								stockQuantity: { gte: -change.stockDelta }
							},
							data: { stockQuantity: { decrement: -change.stockDelta } }
						})
					: await transaction.productSku.updateMany({
							where: { id: change.productSkuId },
							data: { stockQuantity: { increment: change.stockDelta } }
						});
			if (result.count !== 1) {
				throw new AppError(409, 'INSUFFICIENT_STOCK', 'Insufficient stock for this order.');
			}
			await transaction.product.updateMany({
				where: { skus: { some: { id: change.productSkuId } } },
				data: { updatedAt: new Date() }
			});
		}
	};

	const prepareOrderUpdate = async (
		transaction: Prisma.TransactionClient,
		orderId: string,
		input: InternalOrderUpdateInput
	) => {
		const order = await transaction.order.findUnique({
			where: { id: orderId },
			include: {
				business: { include: { label: true } },
				items: { orderBy: [{ createdAt: 'asc' }] }
			}
		});
		if (!order) {
			throw new AppError(404, 'ORDER_NOT_FOUND', 'The requested order could not be found.');
		}
		const current = mapOrder(order);
		if (input.version !== undefined && input.version !== current.version) {
			throw new AppError(
				409,
				'ORDER_CONCURRENTLY_MODIFIED',
				'The order changed while this request was being processed.'
			);
		}

		const status = input.status ?? current.status;
		if (!isOrderStatusTransitionAllowed(current.status, status)) {
			throw new AppError(
				409,
				'INVALID_ORDER_STATUS_TRANSITION',
				'The requested order status transition is not allowed.'
			);
		}
		const businessId = input.businessId === undefined ? current.businessId : input.businessId;
		const customerName =
			input.customerName === undefined ? current.customerName : input.customerName;
		const customerEmail =
			input.customerEmail === undefined ? current.customerEmail : input.customerEmail;
		const customerPhone =
			input.customerPhone === undefined ? current.customerPhone : input.customerPhone;
		const customerAddress =
			input.customerAddress === undefined ? current.customerAddress : input.customerAddress;

		if (input.version !== undefined) {
			assertConsumerContact({ businessId, customerName, customerPhone });
			if (
				businessId &&
				!(await transaction.business.findFirst({
					where: { id: businessId, deletedAt: null },
					select: { id: true }
				}))
			) {
				throw new AppError(
					404,
					'BUSINESS_NOT_FOUND',
					'The requested business record could not be found.'
				);
			}
		}

		const items = await resolveUpdateItems(transaction, current, input.items);
		const preview = buildOrderUpdatePreview(current, {
			status,
			businessId,
			customerName,
			customerEmail,
			customerPhone,
			customerAddress,
			items
		});
		await assertInventoryAvailable(transaction, preview);
		return { current, preview };
	};

	const statusTimestamps = (
		current: ManagedOrderRecord,
		nextStatus: OrderStatus,
		statusChanged: boolean
	) => {
		if (!statusChanged) return {};
		const transitionedAt = new Date();
		if (nextStatus === 'completed') {
			return {
				completedAt: current.completedAt ?? transitionedAt,
				cancelledAt: null,
				refundedAt: null
			};
		}
		if (nextStatus === 'cancelled') {
			return {
				completedAt: null,
				cancelledAt: current.cancelledAt ?? transitionedAt,
				refundedAt: null
			};
		}
		if (nextStatus === 'refunded') {
			return {
				completedAt: current.completedAt ?? transitionedAt,
				cancelledAt: null,
				refundedAt: current.refundedAt ?? transitionedAt
			};
		}
		return { completedAt: null, cancelledAt: null, refundedAt: null };
	};

	const persistOrderItems = async (
		transaction: Prisma.TransactionClient,
		orderId: string,
		items: ManagedOrderPreviewItemRecord[]
	) => {
		const retainedIds = items.flatMap((item) => (item.id ? [item.id] : []));
		await transaction.orderItem.deleteMany({
			where: {
				orderId,
				...(retainedIds.length > 0 ? { id: { notIn: retainedIds } } : {})
			}
		});

		for (const item of items) {
			const data = {
				productSkuId: item.productSkuId,
				skuCode: item.skuCode,
				productName: item.productName,
				unitPrice: item.unitPrice,
				quantity: item.quantity,
				lineTotal: item.lineTotal,
				attributes: item.attributes as Prisma.InputJsonValue
			};
			if (item.id) {
				const result = await transaction.orderItem.updateMany({
					where: { id: item.id, orderId },
					data
				});
				if (result.count !== 1) {
					throw new AppError(
						409,
						'ORDER_CONCURRENTLY_MODIFIED',
						'The order changed while this request was being processed.'
					);
				}
			} else {
				await transaction.orderItem.create({ data: { ...data, orderId } });
			}
		}
	};

	const persistOrderUpdate = (orderId: string, input: InternalOrderUpdateInput) =>
		database.$transaction(async (transaction) => {
			const { current, preview } = await prepareOrderUpdate(transaction, orderId, input);
			await applyInventoryChanges(transaction, preview.changes.inventory);
			const proposed = preview.proposed;
			const statusChanged = proposed.status !== current.status;
			const result = await transaction.order.updateMany({
				where: { id: orderId, version: current.version },
				data: {
					status: proposed.status,
					businessId: proposed.businessId,
					customerName: proposed.customerName,
					customerEmail: proposed.customerEmail,
					customerPhone: proposed.customerPhone,
					customerAddress: proposed.customerAddress,
					itemCount: proposed.itemCount,
					subtotalAmount: proposed.subtotalAmount,
					discountAmount: proposed.discountAmount,
					totalAmount: proposed.totalAmount,
					...statusTimestamps(current, proposed.status, statusChanged),
					version: { increment: 1 }
				}
			});
			if (result.count !== 1) {
				throw new AppError(
					409,
					'ORDER_CONCURRENTLY_MODIFIED',
					'The order changed while this request was being processed.'
				);
			}
			if (input.items) {
				await persistOrderItems(transaction, orderId, proposed.items);
			}

			const updated = await transaction.order.findUniqueOrThrow({
				where: { id: orderId },
				include: {
					business: { include: { label: true } },
					items: { orderBy: [{ createdAt: 'asc' }] }
				}
			});
			const orderRecord = mapOrder(updated);
			const persistedPreview = buildOrderUpdatePreview(current, {
				status: orderRecord.status,
				businessId: orderRecord.businessId,
				customerName: orderRecord.customerName,
				customerEmail: orderRecord.customerEmail,
				customerPhone: orderRecord.customerPhone,
				customerAddress: orderRecord.customerAddress,
				items: orderRecord.items.map((item) => ({
					id: item.id,
					productSkuId: item.productSkuId,
					skuCode: item.skuCode,
					productName: item.productName,
					unitPrice: item.unitPrice,
					quantity: item.quantity,
					attributes: item.attributes
				}))
			});
			return {
				order: orderRecord,
				previousStatus: current.status,
				preview: persistedPreview
			};
		});

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
					id: true,
					skuCode: true,
					price: true,
					attributes: true,
					product: { select: { name: true } }
				}
			});

			return sku
				? {
						id: sku.id,
						skuCode: sku.skuCode,
						productName: sku.product.name,
						price: Number(sku.price.toString()),
						attributes: sku.attributes as Prisma.InputJsonValue
					}
				: null;
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

		async updateOrderStatus(orderId: string, status: OrderStatus) {
			return persistOrderUpdate(orderId, { status });
		},

		async previewOrderUpdate(orderId: string, input: OrderUpdateInput) {
			return database.$transaction(async (transaction) => {
				const { preview } = await prepareOrderUpdate(transaction, orderId, input);
				return preview;
			});
		},

		async updateOrder(orderId: string, input: OrderUpdateInput) {
			return persistOrderUpdate(orderId, input);
		}
	};
}

export type OrderRepository = ReturnType<typeof createPrismaOrderRepository>;
