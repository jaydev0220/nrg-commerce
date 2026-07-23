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

required_variables=(
	DIRECT_URL
	BACKUP_AGE_RECIPIENT
	BACKUP_S3_ENDPOINT
	BACKUP_S3_BUCKET
	AWS_ACCESS_KEY_ID
	AWS_SECRET_ACCESS_KEY
)
for name in "${required_variables[@]}"; do
	require_variable "$name"
done

for command_name in age aws pg_dump sha256sum; do
	require_command "$command_name"
done

umask 077
backup_directory=${BACKUP_DIRECTORY:-/var/backups/nrg-commerce}
backup_prefix=${BACKUP_PREFIX:-nrg-commerce-postgres}
if [[ ! $backup_prefix =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$ ]]; then
	printf 'BACKUP_PREFIX contains unsupported characters.\n' >&2
	exit 1
fi
timestamp=$(date -u +'%Y%m%dT%H%M%SZ')
filename="${backup_prefix}-${timestamp}.dump.age"
temporary_file=$(mktemp)
temporary_checksum=$(mktemp)
trap 'rm -f "$temporary_file" "$temporary_checksum"' EXIT

mkdir -p "$backup_directory"

pg_dump_options=(
	--format=custom
	--compress=zstd:9
	--no-owner
	--no-acl
)
PGDATABASE=$DIRECT_URL pg_dump "${pg_dump_options[@]}" |
	age --recipient "$BACKUP_AGE_RECIPIENT" --output "$temporary_file"

sha256sum "$temporary_file" | awk -v name="$filename" '{ print $1 "  " name }' >"$temporary_checksum"

destination="$backup_directory/$filename"
checksum_destination="$destination.sha256"
mv "$temporary_file" "$destination"
mv "$temporary_checksum" "$checksum_destination"

s3_arguments=(--endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp --only-show-errors)
aws "${s3_arguments[@]}" "$checksum_destination" "s3://$BACKUP_S3_BUCKET/database/$filename.sha256"
aws "${s3_arguments[@]}" "$destination" "s3://$BACKUP_S3_BUCKET/database/$filename"

if [[ ${BACKUP_KEEP_LOCAL:-false} != 'true' ]]; then
	rm -f "$destination" "$checksum_destination"
fi

printf 'Encrypted database backup uploaded as database/%s.\n' "$filename"
