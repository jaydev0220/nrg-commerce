import { createHash, randomUUID } from 'node:crypto';

import type { Prisma } from '@packages/database';

import { AppError } from '../../../errors/app-error.js';
import type { OrderRepository } from './order.repository.js';

type OrderServiceDependencies = {
	repository: Pick<
		OrderRepository,
		| 'listOrders'
		| 'findOrderById'
		| 'findBusinessById'
		| 'findSkuById'
		| 'listOrderSkuLookups'
		| 'createOrder'
		| 'updateOrder'
		| 'updateOrderStatus'
	> &
		Partial<Pick<OrderRepository, 'findOrderByIdempotencyKey'>>;
};

type CreateOrderResult = Awaited<ReturnType<OrderRepository['createOrder']>> & {
	reused?: boolean;
};

type CreateOrderItem =
	| {
			productSkuId: string;
			quantity: number;
	  }
	| {
			productSkuId?: undefined;
			skuCode: string;
			productName: string;
			unitPrice: number;
			quantity: number;
			attributes: Prisma.InputJsonValue;
	  };

type ResolvedOrderItem = {
	productSkuId?: string;
	skuCode: string;
	productName: string;
	unitPrice: number;
	quantity: number;
	attributes: Prisma.InputJsonValue;
};

function isCatalogOrderItem(
	item: CreateOrderItem
): item is Extract<CreateOrderItem, { productSkuId: string }> {
	return typeof item.productSkuId === 'string';
}

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, canonicalize(entry)])
		);
	}
	return value;
}

function fingerprint(input: unknown): string {
	return createHash('sha256')
		.update(JSON.stringify(canonicalize(input)))
		.digest('hex');
}

function isUniqueConstraintError(error: unknown): boolean {
	return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
}

const maxMoneyMinorUnits = 9_999_999_999n;

function roundRate(value: number): number {
	return Math.round(value * 100) / 100;
}

function toMinorUnits(value: number): bigint {
	const minorUnits = Math.round(value * 100);
	if (!Number.isSafeInteger(minorUnits) || minorUnits < 0) {
		throw new AppError(
			400,
			'ORDER_AMOUNT_OUT_OF_RANGE',
			'An order amount is outside the supported range.'
		);
	}
	return BigInt(minorUnits);
}

function fromMinorUnits(value: bigint): number {
	if (value < 0n || value > maxMoneyMinorUnits) {
		throw new AppError(
			400,
			'ORDER_AMOUNT_OUT_OF_RANGE',
			'An order amount is outside the supported range.'
		);
	}
	return Number(value) / 100;
}

function resolveDiscountRate(value: number | undefined, suggestedRate: number | null): number {
	const rate = value ?? suggestedRate ?? 0;
	if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
		throw new AppError(
			400,
			'INVALID_DISCOUNT_RATE',
			'The discount rate must be between 0 and 100 percent.'
		);
	}
	return roundRate(rate);
}

function ensureOrder<T>(order: T | null): T {
	if (!order) {
		throw new AppError(404, 'ORDER_NOT_FOUND', 'The requested order record could not be found.');
	}

	return order;
}

function hasText(value: string | null | undefined): boolean {
	return typeof value === 'string' && value.trim().length > 0;
}

function assertConsumerContact(input: {
	businessId?: string | null;
	customerName?: string | null;
	customerPhone?: string | null;
}) {
	if (input.businessId || (hasText(input.customerName) && hasText(input.customerPhone))) {
		return;
	}

	throw new AppError(
		400,
		'CUSTOMER_CONTACT_REQUIRED',
		'Customer name and phone are required for consumer orders.'
	);
}

export function createOrderService(dependencies: OrderServiceDependencies) {
	return {
		listOrders(query: Parameters<OrderRepository['listOrders']>[0]) {
			return dependencies.repository.listOrders(query);
		},

		listOrderSkuLookups(query: Parameters<OrderRepository['listOrderSkuLookups']>[0]) {
			return dependencies.repository.listOrderSkuLookups(query);
		},

		async getOrder(orderId: string) {
			return ensureOrder(await dependencies.repository.findOrderById(orderId));
		},

		async createOrder(input: {
			idempotencyKey?: string;
			businessId?: string | null;
			customerName?: string | null;
			customerEmail?: string | null;
			customerPhone?: string | null;
			customerAddress?: string | null;
			discountRate?: number;
			items: CreateOrderItem[];
		}): Promise<CreateOrderResult> {
			const idempotencyKey = input.idempotencyKey ?? randomUUID();
			const requestFingerprint = fingerprint({ ...input, idempotencyKey: undefined });
			const existing = dependencies.repository.findOrderByIdempotencyKey
				? await dependencies.repository.findOrderByIdempotencyKey(idempotencyKey)
				: null;
			if (existing) {
				if (existing.fingerprint !== requestFingerprint) {
					throw new AppError(
						409,
						'IDEMPOTENCY_KEY_REUSED',
						'The idempotency key was already used for a different order.'
					);
				}
				return { ...existing.order, reused: true };
			}

			assertConsumerContact(input);
			let business: Awaited<ReturnType<OrderRepository['findBusinessById']>> = null;
			if (input.businessId) {
				business = await dependencies.repository.findBusinessById(input.businessId);

				if (!business) {
					throw new AppError(
						404,
						'BUSINESS_NOT_FOUND',
						'The requested business record could not be found.'
					);
				}
			}

			const skuSnapshots = new Map<
				string,
				NonNullable<Awaited<ReturnType<OrderRepository['findSkuById']>>>
			>();
			for (const item of input.items) {
				if (!isCatalogOrderItem(item)) continue;

				const sku =
					skuSnapshots.get(item.productSkuId) ??
					(await dependencies.repository.findSkuById(item.productSkuId));

				if (!sku) {
					throw new AppError(
						404,
						'PRODUCT_SKU_NOT_FOUND',
						'One or more referenced product SKUs could not be found.'
					);
				}
				skuSnapshots.set(item.productSkuId, sku);
			}

			const resolvedItems: ResolvedOrderItem[] = input.items.map((item) => {
				if (!isCatalogOrderItem(item)) return item;
				const sku = skuSnapshots.get(item.productSkuId);
				if (!sku) throw new Error('Validated product SKU snapshot is missing.');
				return {
					productSkuId: sku.id,
					skuCode: sku.skuCode,
					productName: sku.productName,
					unitPrice: sku.price,
					quantity: item.quantity,
					attributes: sku.attributes
				};
			});
			const itemCalculations = resolvedItems.map((item) => {
				const lineTotalMinorUnits = toMinorUnits(item.unitPrice) * BigInt(item.quantity);
				return {
					item: {
						...item,
						lineTotal: fromMinorUnits(lineTotalMinorUnits)
					},
					lineTotalMinorUnits
				};
			});
			const items = itemCalculations.map(({ item }) => item);
			const itemCount = items.reduce((total, item) => total + item.quantity, 0);
			const subtotalMinorUnits = itemCalculations.reduce(
				(total, item) => total + item.lineTotalMinorUnits,
				0n
			);
			const subtotalAmount = fromMinorUnits(subtotalMinorUnits);
			const suggestedDiscountRate = business?.label?.deletedAt
				? null
				: (business?.label?.discountRate ?? null);
			const discountRate = resolveDiscountRate(input.discountRate, suggestedDiscountRate);
			const discountBasisPoints = BigInt(Math.round(discountRate * 100));
			const discountMinorUnits = (subtotalMinorUnits * discountBasisPoints + 5_000n) / 10_000n;
			const discountAmount = fromMinorUnits(discountMinorUnits);
			const totalAmount = fromMinorUnits(subtotalMinorUnits - discountMinorUnits);

			try {
				return {
					...(await dependencies.repository.createOrder({
						...input,
						idempotencyKey,
						idempotencyFingerprint: requestFingerprint,
						itemCount,
						subtotalAmount,
						discountLabelId: business?.label?.id ?? null,
						discountLabelName: business?.label?.name ?? null,
						suggestedDiscountRate,
						discountRate,
						discountAmount,
						totalAmount,
						items
					})),
					reused: false
				};
			} catch (error) {
				if (!isUniqueConstraintError(error)) throw error;
				if (!dependencies.repository.findOrderByIdempotencyKey) throw error;
				const concurrent = await dependencies.repository.findOrderByIdempotencyKey(idempotencyKey);
				if (!concurrent) throw error;
				if (concurrent.fingerprint !== requestFingerprint) {
					throw new AppError(
						409,
						'IDEMPOTENCY_KEY_REUSED',
						'The idempotency key was already used for a different order.'
					);
				}
				return { ...concurrent.order, reused: true };
			}
		},

		async updateOrderStatus(
			orderId: string,
			status: Parameters<OrderRepository['updateOrderStatus']>[1]
		) {
			return dependencies.repository.updateOrderStatus(orderId, status);
		},

		async updateOrder(
			orderId: string,
			input: {
				status?: Parameters<OrderRepository['updateOrderStatus']>[1];
				businessId?: string | null;
				customerName?: string | null;
				customerEmail?: string | null;
				customerPhone?: string | null;
				customerAddress?: string | null;
			}
		) {
			const existingOrder = ensureOrder(await dependencies.repository.findOrderById(orderId));
			const businessId =
				input.businessId === undefined ? existingOrder.businessId : input.businessId;
			const customerName =
				input.customerName === undefined ? existingOrder.customerName : input.customerName;
			const customerPhone =
				input.customerPhone === undefined ? existingOrder.customerPhone : input.customerPhone;
			assertConsumerContact({ businessId, customerName, customerPhone });

			if (businessId && !(await dependencies.repository.findBusinessById(businessId))) {
				throw new AppError(
					404,
					'BUSINESS_NOT_FOUND',
					'The requested business record could not be found.'
				);
			}
			return dependencies.repository.updateOrder(orderId, input);
		}
	};
}

export type OrderService = ReturnType<typeof createOrderService>;
