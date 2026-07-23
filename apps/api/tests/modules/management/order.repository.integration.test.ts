import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { createDatabaseClient } from '@packages/database';
import { managedOrderResponseSchema } from '@packages/schemas';
import { Pool } from 'pg';

import { AppError } from '../../../src/errors/app-error.js';
import { createPrismaOrderRepository } from '../../../src/modules/management/order/order.repository.js';

const databaseUrl = process.env['TEST_DATABASE_URL'];

test(
	'order repository enforces lifecycle timestamps and restores inventory once',
	{ skip: databaseUrl ? false : 'TEST_DATABASE_URL is not configured.' },
	async () => {
		const pool = new Pool({ connectionString: databaseUrl, max: 5 });
		const database = createDatabaseClient({ pool });
		const repository = createPrismaOrderRepository(database);
		const unique = randomUUID();
		const product = await database.product.create({
			data: {
				slug: `order-integration-${unique}`,
				name: 'Order integration product',
				skus: {
					create: {
						skuCode: `ORDER-${unique}`,
						price: 10,
						stockQuantity: 8,
						attributes: {}
					}
				}
			},
			include: { skus: true }
		});
		const sku = product.skus[0];
		assert.ok(sku);

		try {
			const order = await database.order.create({
				data: {
					status: 'processing',
					customerName: 'Integration buyer',
					customerPhone: '0912345678',
					itemCount: 2,
					subtotalAmount: 20,
					discountRate: 0,
					discountAmount: 0,
					totalAmount: 20,
					items: {
						create: {
							productSkuId: sku.id,
							skuCode: sku.skuCode,
							productName: product.name,
							unitPrice: 10,
							quantity: 2,
							lineTotal: 20,
							attributes: {}
						}
					}
				}
			});

			const completed = await repository.updateOrderStatus(order.id, 'completed');
			assert.equal(completed.previousStatus, 'processing');
			assert.equal(completed.order.status, 'completed');
			assert.equal(completed.order.version, 1);
			assert.ok(completed.order.completedAt);
			assert.equal(completed.order.cancelledAt, null);
			assert.equal(completed.order.refundedAt, null);
			assert.doesNotThrow(() => managedOrderResponseSchema.parse(completed.order));

			const refunded = await repository.updateOrderStatus(order.id, 'refunded');
			assert.equal(refunded.previousStatus, 'completed');
			assert.equal(refunded.order.status, 'refunded');
			assert.equal(refunded.order.version, 2);
			assert.ok(refunded.order.refundedAt);
			assert.doesNotThrow(() => managedOrderResponseSchema.parse(refunded.order));
			assert.equal(
				(await database.productSku.findUniqueOrThrow({ where: { id: sku.id } })).stockQuantity,
				10
			);

			await repository.updateOrderStatus(order.id, 'refunded');
			assert.equal(
				(await database.productSku.findUniqueOrThrow({ where: { id: sku.id } })).stockQuantity,
				10
			);

			const pending = await database.order.create({
				data: {
					status: 'pending',
					customerName: 'Pending buyer',
					customerPhone: '0912345678',
					itemCount: 0,
					subtotalAmount: 0,
					discountRate: 0,
					discountAmount: 0,
					totalAmount: 0
				}
			});
			await assert.rejects(
				() => repository.updateOrderStatus(pending.id, 'completed'),
				(error: unknown) =>
					error instanceof AppError && error.code === 'INVALID_ORDER_STATUS_TRANSITION'
			);
		} finally {
			await database.order.deleteMany({
				where: { items: { some: { productSkuId: sku.id } } }
			});
			await database.order.deleteMany({
				where: { customerName: 'Pending buyer', createdAt: { gte: product.createdAt } }
			});
			await database.productSku.delete({ where: { id: sku.id } });
			await database.product.delete({ where: { id: product.id } });
			await database.$disconnect();
			await pool.end();
		}
	}
);
