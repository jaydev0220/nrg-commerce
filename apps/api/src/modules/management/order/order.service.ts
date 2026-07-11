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
		| 'createOrder'
		| 'updateOrderStatus'
	>;
};

function roundMoney(value: number): number {
	return Math.round(value * 100) / 100;
}

function ensureOrder<T>(order: T | null): T {
	if (!order) {
		throw new AppError(404, 'ORDER_NOT_FOUND', 'The requested order record could not be found.');
	}

	return order;
}

export function createOrderService(dependencies: OrderServiceDependencies) {
	return {
		listOrders(query: Parameters<OrderRepository['listOrders']>[0]) {
			return dependencies.repository.listOrders(query);
		},

		async getOrder(orderId: string) {
			return ensureOrder(await dependencies.repository.findOrderById(orderId));
		},

		async createOrder(input: {
			businessId?: string;
			customerName?: string;
			customerEmail?: string;
			customerPhone?: string;
			customerAddress?: string;
			items: Array<{
				productSkuId?: string;
				skuCode: string;
				productName: string;
				unitPrice: number;
				quantity: number;
				attributes: Prisma.InputJsonValue;
			}>;
		}) {
			if (input.businessId) {
				const business = await dependencies.repository.findBusinessById(input.businessId);

				if (!business) {
					throw new AppError(
						404,
						'BUSINESS_NOT_FOUND',
						'The requested business record could not be found.'
					);
				}
			}

			for (const item of input.items) {
				if (!item.productSkuId) {
					continue;
				}

				const sku = await dependencies.repository.findSkuById(item.productSkuId);

				if (!sku) {
					throw new AppError(
						404,
						'PRODUCT_SKU_NOT_FOUND',
						'One or more referenced product SKUs could not be found.'
					);
				}
			}

			const items = input.items.map((item) => ({
				...item,
				lineTotal: roundMoney(item.unitPrice * item.quantity)
			}));
			const itemCount = items.reduce((total, item) => total + item.quantity, 0);
			const totalAmount = roundMoney(items.reduce((total, item) => total + item.lineTotal, 0));

			return dependencies.repository.createOrder({
				...input,
				itemCount,
				totalAmount,
				items
			});
		},

		async updateOrderStatus(
			orderId: string,
			status: Parameters<OrderRepository['updateOrderStatus']>[1]
		) {
			const existingOrder = ensureOrder(await dependencies.repository.findOrderById(orderId));
			const order = await dependencies.repository.updateOrderStatus(orderId, status);

			return {
				order,
				previousStatus: existingOrder.status
			};
		}
	};
}

export type OrderService = ReturnType<typeof createOrderService>;
