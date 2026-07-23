import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const operationsDirectory = new URL('../../../scripts/operations/', import.meta.url);
const backupService = new URL(
	'../../../deploy/systemd/nrg-commerce-backup.service',
	import.meta.url
);

test('database tooling keeps connection URLs out of process arguments', async () => {
	const [backup, restore] = await Promise.all([
		readFile(new URL('backup-database.sh', operationsDirectory), 'utf8'),
		readFile(new URL('restore-database.sh', operationsDirectory), 'utf8')
	]);

	assert.doesNotMatch(backup, /--dbname=.*DIRECT_URL/u);
	assert.match(backup, /PGDATABASE=\$DIRECT_URL pg_dump/u);
	assert.doesNotMatch(restore, /--dbname=.*RESTORE_DATABASE_URL/u);
	assert.match(restore, /PGDATABASE=\$RESTORE_DATABASE_URL (?:psql|pg_restore)/u);
	assert.match(restore, /--single-transaction/u);
	assert.match(backup, /BACKUP_PREFIX contains unsupported characters/u);
	const checksumUpload = backup.indexOf('aws "${s3_arguments[@]}" "$checksum_destination"');
	const backupUpload = backup.indexOf('aws "${s3_arguments[@]}" "$destination"');
	assert.ok(checksumUpload >= 0);
	assert.ok(backupUpload >= 0);
	assert.ok(
		checksumUpload < backupUpload,
		'The remote checksum must be uploaded before the encrypted backup object.'
	);
});

test('database backup service runs with a restrictive systemd sandbox', async () => {
	const service = await readFile(backupService, 'utf8');

	assert.match(service, /^User=nrg-commerce$/mu);
	assert.match(service, /^UMask=0077$/mu);
	assert.match(service, /^CapabilityBoundingSet=$/mu);
	assert.match(service, /^NoNewPrivileges=true$/mu);
	assert.match(service, /^PrivateDevices=true$/mu);
	assert.match(service, /^ProtectSystem=strict$/mu);
	assert.match(service, /^ProtectKernelTunables=true$/mu);
	assert.match(service, /^RestrictNamespaces=true$/mu);
	assert.match(service, /^ReadWritePaths=\/var\/backups\/nrg-commerce$/mu);
});
