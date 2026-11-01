import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../', import.meta.url);
const cleanup = fileURLToPath(new URL('scripts/operations/cleanup-api-revisions.sh', root));

async function runShell(t, args, environment = {}) {
	const directory = await mkdtemp(join(tmpdir(), 'nrg-api-revisions-'));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const log = join(directory, 'calls.jsonl');
	await writeFile(log, '');
	await writeFile(
		join(directory, 'az'),
		`#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.AZ_LOG, JSON.stringify(args) + '\\n');
const operation = args.slice(0, 3).join(' ');
if (operation === process.env.FAIL_OPERATION) process.exit(1);
if (operation === 'containerapp revision list') console.log(process.env.REVISIONS);
if (operation === 'containerapp revision show') {
  const calls = fs.readFileSync(process.env.AZ_LOG, 'utf8');
  const count = calls.split('\\n').filter(line => line.includes('"show"')).length;
  console.log(count <= Number(process.env.UNHEALTHY_ATTEMPTS || 0)
    ? JSON.stringify({ running: 'Activating', health: 'Unhealthy' })
    : JSON.stringify({ running: 'Running', health: 'Healthy' }));
}
`,
		{ mode: 0o755 }
	);
	await writeFile(join(directory, 'sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
	const result = spawnSync('bash', args, {
		env: {
			...process.env,
			PATH: `${directory}:${process.env['PATH']}`,
			AZ_LOG: log,
			AZURE_CONTAINER_APP_NAME: 'api',
			AZURE_RESOURCE_GROUP: 'production',
			API_REVISION: 'current',
			...environment
		},
		encoding: 'utf8',
		timeout: 30_000
	});
	assert.ifError(result.error);
	const calls = (await readFile(log, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
	return { ...result, calls };
}

function revision(name, trafficWeight, active = true, healthState = 'Healthy') {
	return { name, properties: { active, trafficWeight, healthState } };
}

test('cleanup deactivates only active unused revisions and preserves the live revision', async (t) => {
	const result = await runShell(t, [cleanup], {
		REVISIONS: JSON.stringify([
			revision('old', 0),
			revision('current', 100),
			revision('older', 0),
			revision('inactive', 0, false)
		])
	});
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(
		result.calls.slice(1).map((args) => args[args.indexOf('--revision') + 1]),
		['old', 'older']
	);
	assert.ok(result.calls.slice(1).every((args) => args[2] === 'deactivate'));
});

test('cleanup is safe when only the live revision remains', async (t) => {
	const result = await runShell(t, [cleanup], {
		REVISIONS: JSON.stringify([revision('current', 100)])
	});
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.calls.length, 1);
});

test('cleanup refuses missing, unhealthy, inactive, or partially routed targets', async (t) => {
	for (const revisions of [
		[revision('old', 100)],
		[revision('current', 100, true, 'Unhealthy')],
		[revision('current', 100, false)],
		[revision('current', 50), revision('old', 50)]
	]) {
		const result = await runShell(t, [cleanup], { REVISIONS: JSON.stringify(revisions) });
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /Refusing cleanup/u);
		assert.equal(result.calls.length, 1);
	}
});

test('cleanup propagates Azure list and deactivation failures', async (t) => {
	for (const operation of ['list', 'deactivate']) {
		const result = await runShell(t, [cleanup], {
			REVISIONS: JSON.stringify([revision('current', 100), revision('old', 0)]),
			FAIL_OPERATION: `containerapp revision ${operation}`
		});
		assert.notEqual(result.status, 0);
	}
});

test('rollback activates an inactive revision and waits for health before routing traffic', async (t) => {
	const workflow = await readFile(
		new URL('.github/workflows/rollback-production.yml', root),
		'utf8'
	);
	const match = workflow.match(
		/- name: Activate and route API revision\n        run: \|\n([\s\S]*?)        env:/u
	);
	assert.ok(match);
	const script = match[1].replace(/^          /gmu, '');
	const result = await runShell(t, ['-c', script], { UNHEALTHY_ATTEMPTS: '1' });
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(
		result.calls.map((args) => args.slice(0, 3).join(' ')),
		[
			'containerapp revision activate',
			'containerapp revision show',
			'containerapp revision show',
			'containerapp ingress traffic'
		]
	);
	assert.ok(result.calls.at(-1).includes('current=100'));
	assert.ok(result.calls.at(-1).includes('--revision-weight'));

	const failed = await runShell(t, ['-c', script], { UNHEALTHY_ATTEMPTS: '30' });
	assert.notEqual(failed.status, 0);
	assert.ok(failed.calls.every((args) => args[1] !== 'ingress'));
	const activationFailed = await runShell(t, ['-c', script], {
		FAIL_OPERATION: 'containerapp revision activate'
	});
	assert.notEqual(activationFailed.status, 0);
	assert.equal(activationFailed.calls.length, 1);
});

test('cleanup runs only after successful release and rollback work', async () => {
	const release = await readFile(new URL('.github/workflows/ci-deploy.yml', root), 'utf8');
	const rollback = await readFile(
		new URL('.github/workflows/rollback-production.yml', root),
		'utf8'
	);
	const manifest = release.slice(release.indexOf('  release-manifest:'));
	assert.match(
		manifest,
		/needs: \[migrate, deploy-api, deploy-contact, deploy-frontends, publish-api-image\]/u
	);
	assert.match(
		manifest,
		/write-release-manifest\.mjs[^\n]*\n\s+bash scripts\/operations\/cleanup-api-revisions\.sh/u
	);
	assert.ok(
		rollback.indexOf('Deactivate unused API revisions') >
			rollback.indexOf('Roll back selected Workers')
	);
	assert.match(rollback, /run: bash scripts\/operations\/cleanup-api-revisions\.sh/u);
});
