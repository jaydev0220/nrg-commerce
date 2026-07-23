#!/usr/bin/env bash
set -Eeuo pipefail

require_variable() {
	local name=$1
	if [[ -z "${!name:-}" ]]; then
		printf 'Required environment variable %s is missing.\n' "$name" >&2
		exit 1
	fi
}

require_command() {
	if ! command -v "$1" >/dev/null 2>&1; then
		printf 'Required command %s is not installed.\n' "$1" >&2
		exit 1
	fi
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
	printf 'Usage: %s BACKUP_FILE [CHECKSUM_FILE]\n' "$0" >&2
	exit 1
fi

backup_file=$1
checksum_file=${2:-"$backup_file.sha256"}

for name in RESTORE_DATABASE_URL BACKUP_AGE_IDENTITY CONFIRM_RESTORE; do
	require_variable "$name"
done

if [[ $CONFIRM_RESTORE != 'restore-empty-database' ]]; then
	printf 'Set CONFIRM_RESTORE=restore-empty-database to authorize this operation.\n' >&2
	exit 1
fi

for command_name in age pg_restore psql sha256sum; do
	require_command "$command_name"
done

if [[ ! -f $backup_file || ! -f $checksum_file ]]; then
	printf 'Backup and checksum files must both exist.\n' >&2
	exit 1
fi

expected_checksum=$(awk 'NR == 1 { print $1 }' "$checksum_file")
actual_checksum=$(sha256sum "$backup_file" | awk '{ print $1 }')
if [[ ! $expected_checksum =~ ^[0-9a-f]{64}$ || $actual_checksum != "$expected_checksum" ]]; then
	printf 'Backup checksum validation failed.\n' >&2
	exit 1
fi

user_table_count=$(PGDATABASE=$RESTORE_DATABASE_URL psql --no-psqlrc --tuples-only --no-align \
	--command="SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema');")

if [[ $user_table_count != '0' ]]; then
	printf 'Restore target is not empty; refusing to overwrite existing data.\n' >&2
	exit 1
fi

pg_restore_options=(
	--exit-on-error
	--single-transaction
	--no-owner
	--no-acl
)
age --decrypt --identity "$BACKUP_AGE_IDENTITY" "$backup_file" |
	PGDATABASE=$RESTORE_DATABASE_URL pg_restore "${pg_restore_options[@]}"

PGDATABASE=$RESTORE_DATABASE_URL psql --no-psqlrc --command='SELECT 1;' >/dev/null
printf 'Database restore completed and connectivity was verified.\n'
