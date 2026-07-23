import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import pg, { type PoolClient } from 'pg';

const databaseUrl = process.env['TEST_DATABASE_URL'];

async function expectDatabaseError(
	client: PoolClient,
	savepoint: string,
	operation: () => Promise<unknown>,
	expectedCode: string,
	expectedConstraint: string
): Promise<void> {
	await client.query(`SAVEPOINT ${savepoint}`);
	try {
		await operation();
		assert.fail(`Expected database error ${expectedConstraint}.`);
	} catch (error) {
		assert.ok(error && typeof error === 'object' && 'code' in error && 'constraint' in error);
		assert.equal(error.code, expectedCode);
		assert.equal(error.constraint, expectedConstraint);
	} finally {
		await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
	}
}

test(
	'initial migration is applied without failures',
	{ skip: databaseUrl ? false : 'TEST_DATABASE_URL is not configured.' },
	async () => {
		const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
		try {
			const result = await pool.query<{
				finished_at: Date | null;
				rolled_back_at: Date | null;
			}>(
				`SELECT "finished_at", "rolled_back_at"
				 FROM "_prisma_migrations"
				 WHERE "migration_name" = $1`,
				['20260721000000_initial']
			);

			assert.equal(result.rowCount, 1);
			assert.ok(result.rows[0]?.finished_at);
			assert.equal(result.rows[0]?.rolled_back_at, null);
		} finally {
			await pool.end();
		}
	}
);

test(
	'database constraints reject invalid security and order records',
	{ skip: databaseUrl ? false : 'TEST_DATABASE_URL is not configured.' },
	async () => {
		const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
		const client = await pool.connect();
		try {
			await client.query('BEGIN');

			await expectDatabaseError(
				client,
				'invalid_staff',
				() =>
					client.query(
						`INSERT INTO "Staff" ("id", "email", "name", "failedAuthCount", "updatedAt")
						 VALUES ($1, $2, $3, -1, CURRENT_TIMESTAMP)`,
						[randomUUID(), `invalid-${randomUUID()}@example.com`, 'Invalid staff']
					),
				'23514',
				'Staff_failedAuthCount_check'
			);

			const staffId = randomUUID();
			await client.query(
				`INSERT INTO "Staff" ("id", "email", "name", "status", "updatedAt")
				 VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP)`,
				[staffId, `integration-${staffId}@example.com`, 'Integration staff']
			);
			await client.query(
				`INSERT INTO "TotpCredential"
					("id", "staffId", "secretEncrypted", "digits", "period", "verifiedAt", "updatedAt")
				 VALUES ($1, $2, 'encrypted', 6, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
				[randomUUID(), staffId]
			);
			await expectDatabaseError(
				client,
				'duplicate_totp',
				() =>
					client.query(
						`INSERT INTO "TotpCredential"
							("id", "staffId", "secretEncrypted", "digits", "period", "verifiedAt", "updatedAt")
						 VALUES ($1, $2, 'encrypted-again', 6, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
						[randomUUID(), staffId]
					),
				'23505',
				'TotpCredential_one_active_per_staff_idx'
			);

			const orderId = randomUUID();
			await client.query(
				`INSERT INTO "Order"
					("id", "status", "itemCount", "subtotalAmount", "discountRate",
					 "discountAmount", "totalAmount", "updatedAt")
				 VALUES ($1, 'pending', 1, 10, 0, 0, 10, CURRENT_TIMESTAMP)`,
				[orderId]
			);
			await expectDatabaseError(
				client,
				'invalid_order_status',
				() =>
					client.query(
						`INSERT INTO "Order"
							("id", "status", "itemCount", "subtotalAmount", "discountRate",
							 "discountAmount", "totalAmount", "updatedAt")
						 VALUES ($1, 'cancelled', 0, 0, 0, 0, 0, CURRENT_TIMESTAMP)`,
						[randomUUID()]
					),
				'23514',
				'Order_cancelledAt_check'
			);
			await expectDatabaseError(
				client,
				'invalid_order_item',
				() =>
					client.query(
						`INSERT INTO "OrderItem"
							("id", "orderId", "skuCode", "productName", "unitPrice",
							 "quantity", "lineTotal", "attributes")
						 VALUES ($1, $2, 'SKU-1', 'Product', 10, 2, 19, '{}'::jsonb)`,
						[randomUUID(), orderId]
					),
				'23514',
				'OrderItem_lineTotal_check'
			);
		} finally {
			await client.query('ROLLBACK');
			client.release();
			await pool.end();
		}
	}
);
