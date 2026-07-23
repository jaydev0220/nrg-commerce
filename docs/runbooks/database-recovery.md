# Database Recovery

## Targets

- RPO: 15 minutes.
- RTO: 60 minutes.
- Primary recovery method: managed PostgreSQL point-in-time recovery.
- Secondary recovery method: daily client-side-encrypted logical backups in the private R2 backup bucket.

The daily logical backup does not satisfy the RPO by itself. Enable managed continuous backups with a recovery window of at least seven days.

## Backup setup

Install PostgreSQL 18 client tools, `age`, and AWS CLI v2 on the backup host. Store `backup.env` with mode `0600` and these values:

```text
DIRECT_URL=postgresql://...
BACKUP_AGE_RECIPIENT=age1...
BACKUP_S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
BACKUP_S3_BUCKET=nrg-commerce-database-backups
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=auto
```

Use a dedicated R2 token limited to the backup bucket. Keep the age private identity offline and in the organization secret-recovery system. Install the unit files in `deploy/systemd`, then enable the timer:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now nrg-commerce-backup.timer
sudo systemctl list-timers nrg-commerce-backup.timer
```

Alert when no successful backup object and checksum have appeared in 26 hours.

## Point-in-time recovery

1. Declare an incident and stop API writes.
2. Record the last known good UTC timestamp and current image SHA.
3. Restore the managed database to a new instance at that timestamp.
4. Set staging API credentials to the restored instance.
5. Run `pnpm --filter @packages/database db:deploy`.
6. Verify counts for staff, products, SKUs, businesses, orders, sessions, and logs.
7. Exercise readiness, staff login, storefront reads, and a reversible order write.
8. Switch the production secret to the restored database and restart API replicas.
9. Keep the old instance isolated and read-only until the incident is closed.

## Logical restore drill

Download one `.dump.age` object and its `.sha256` file. Create an empty, isolated PostgreSQL 18 database, then run:

```bash
export RESTORE_DATABASE_URL=postgresql://...
export BACKUP_AGE_IDENTITY=/secure/path/backup-identity.txt
export CONFIRM_RESTORE=restore-empty-database
scripts/operations/restore-database.sh backup.dump.age backup.dump.age.sha256
```

The restore script verifies the checksum, refuses any target containing user tables, and restores in a single transaction. After restoration, run migrations, API integration tests, and representative data checks. Record elapsed time and evidence. Perform this drill at least quarterly and after material schema or backup-tool changes.
