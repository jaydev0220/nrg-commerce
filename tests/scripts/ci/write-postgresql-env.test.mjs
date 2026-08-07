import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
	parsePostgresqlConnection,
	writePostgresqlTerraformEnv
} from '../../../scripts/ci/write-postgresql-env.mjs';

test('parses a verified Neon PostgreSQL URL without exposing its value in errors', () => {
	assert.deepEqual(
		parsePostgresqlConnection(
			'postgresql://owner:p%40ss@ep-example.ap-southeast-1.aws.neon.tech:5432/nrg_commerce?sslmode=verify-full'
		),
		{
			host: 'ep-example.ap-southeast-1.aws.neon.tech',
			port: 5432,
			username: 'owner',
			password: 'p@ss'
		}
	);
});

test('rejects insecure or malformed owner URLs', () => {
	for (const value of [
		'postgresql://owner:password@database.example.com/nrg_commerce',
		'postgresql://owner:password@database.example.com/nrg_commerce?sslmode=require',
		'postgresql://owner:%ZZ@database.example.com/nrg_commerce?sslmode=verify-full',
		'not-a-database-url'
	]) {
		assert.throws(() => parsePostgresqlConnection(value), /OWNER_DATABASE_URL/u);
	}
});

test('writes Terraform provider fields to the requested environment file', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'nrg-postgresql-env-'));
	const path = join(directory, 'github.env');
	await writePostgresqlTerraformEnv(
		path,
		'postgresql://owner:p%40ss@database.example.com/nrg_commerce?sslmode=verify-full'
	);
	const contents = await readFile(path, 'utf8');
	assert.match(contents, /TF_VAR_postgresql_host=database\.example\.com/u);
	assert.match(contents, /TF_VAR_postgresql_username=owner/u);
	assert.match(contents, /TF_VAR_postgresql_password=p@ss/u);
});
