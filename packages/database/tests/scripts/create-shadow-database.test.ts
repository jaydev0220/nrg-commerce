import assert from 'node:assert/strict';
import test from 'node:test';

import { createShadowDatabase } from '../../scripts/create-shadow-database.js';

type QueryResult = { rows: Array<{ exists: number }> };

function createClient(options: { exists?: boolean; createError?: unknown } = {}) {
	const queries: Array<{ text: string; values?: unknown[] }> = [];
	let connected = false;
	let ended = false;

	return {
		queries,
		get connected() {
			return connected;
		},
		get ended() {
			return ended;
		},
		client: {
			connect: async () => {
				connected = true;
			},
			query: async (text: string, values?: unknown[]): Promise<QueryResult> => {
				queries.push({ text, values });
				if (text.startsWith('SELECT')) {
					return { rows: options.exists ? [{ exists: 1 }] : [] };
				}
				if (options.createError) throw options.createError;
				return { rows: [] };
			},
			end: async () => {
				ended = true;
			}
		}
	};
}

const adminUrl = 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';
const shadowUrl = 'postgresql://postgres:postgres@127.0.0.1:5432/nrg_commerce_shadow';

test('createShadowDatabase creates a missing validated database and closes the connection', async () => {
	const stub = createClient();
	const result = await createShadowDatabase(adminUrl, shadowUrl, () => stub.client as never);

	assert.equal(result, 'created');
	assert.equal(stub.connected, true);
	assert.equal(stub.ended, true);
	assert.deepEqual(stub.queries, [
		{
			text: 'SELECT 1 AS "exists" FROM pg_database WHERE datname = $1',
			values: ['nrg_commerce_shadow']
		},
		{ text: 'CREATE DATABASE "nrg_commerce_shadow"', values: undefined }
	]);
});

test('createShadowDatabase is idempotent for existing and concurrently created databases', async () => {
	const existing = createClient({ exists: true });
	assert.equal(
		await createShadowDatabase(adminUrl, shadowUrl, () => existing.client as never),
		'exists'
	);
	assert.equal(existing.queries.length, 1);

	const raced = createClient({ createError: { code: '42P04' } });
	assert.equal(
		await createShadowDatabase(adminUrl, shadowUrl, () => raced.client as never),
		'exists'
	);
	assert.equal(raced.ended, true);
});

test('createShadowDatabase rejects unsafe or unrelated database targets before connecting', async () => {
	let clientCreated = false;
	const clientFactory = () => {
		clientCreated = true;
		return {};
	};

	for (const invalidShadowUrl of [
		'not-a-url',
		'https://127.0.0.1/nrg_commerce_shadow',
		'postgresql://postgres:postgres@127.0.0.1:5432/unsafe-name',
		'postgresql://postgres:postgres@database.example.test:5432/nrg_commerce_shadow',
		adminUrl
	]) {
		await assert.rejects(() =>
			createShadowDatabase(adminUrl, invalidShadowUrl, clientFactory as never)
		);
	}
	assert.equal(clientCreated, false);
});
