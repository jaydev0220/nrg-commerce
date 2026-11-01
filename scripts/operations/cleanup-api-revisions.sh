#!/usr/bin/env bash
set -Eeuo pipefail

: "${AZURE_CONTAINER_APP_NAME:?}"
: "${AZURE_RESOURCE_GROUP:?}"
: "${API_REVISION:?}"

revisions="$(az containerapp revision list --name "$AZURE_CONTAINER_APP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --output json)"
if ! jq -e --arg revision "$API_REVISION" '
	any(.[]; .name == $revision and .properties.active == true and .properties.trafficWeight == 100 and .properties.healthState == "Healthy")
' <<<"$revisions" >/dev/null; then
	printf 'Refusing cleanup: target revision must be healthy, active, and serving 100%% of traffic.\n' >&2
	exit 1
fi

obsolete_revisions="$(jq -r --arg revision "$API_REVISION" '
	.[] | select(.name != $revision and .properties.active == true and .properties.trafficWeight == 0) | .name
' <<<"$revisions")"
while IFS= read -r revision; do
	[[ -n "$revision" ]] || continue
	az containerapp revision deactivate --name "$AZURE_CONTAINER_APP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --revision "$revision" --output none
done <<<"$obsolete_revisions"
