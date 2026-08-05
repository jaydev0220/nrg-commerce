# API DNS

This Terraform root owns only the public API CNAME and the Azure Container Apps `asuid` TXT record. It is intentionally separate from the Cloudflare asset and Worker infrastructure state.

Use one HCP Terraform workspace per environment, such as `nrg-commerce-api-dns-staging` and `nrg-commerce-api-dns-production`. CI supplies the workspace and all `TF_VAR_*` values after it reads the Container Apps generated hostname and domain verification ID.

The CNAME is proxied after the custom-domain binding is established. CI may temporarily apply `TF_VAR_proxied=false` when Azure requires direct DNS validation, then immediately reapplies the proxied state.

Existing records are reconciled and imported by `scripts/ci/import-api-dns.mjs` before Terraform plans. The helper fails when a matching name/type has multiple records or points at an unexpected origin.
