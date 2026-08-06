# API DNS

This Terraform root owns only the public API CNAME and the Azure Container Apps `asuid` TXT record. It is intentionally separate from the Cloudflare asset and Worker infrastructure state.

Use one HCP Terraform workspace per environment, such as `nrg-commerce-api-dns-staging` and `nrg-commerce-api-dns-production`. CI supplies the workspace and all `TF_VAR_*` values after it reads the Container Apps generated hostname and domain verification ID.

The API CNAME remains proxied through Cloudflare during normal operation. CI uploads a bring-your-own origin certificate to the Container Apps environment and binds it explicitly to the API hostname. If Azure requires direct CNAME validation during binding, CI temporarily applies `TF_VAR_proxied=false` and restores the proxied state immediately afterward.

The deployment requires the environment-scoped GitHub secrets `API_ORIGIN_CERTIFICATE_PFX_BASE64` and `API_ORIGIN_CERTIFICATE_PASSWORD`. The PFX must contain the private key and a certificate valid for `API_DOMAIN`; a Cloudflare Origin CA certificate is appropriate because the origin only accepts Cloudflare traffic.

Existing records are reconciled and imported by `scripts/ci/import-api-dns.mjs` before Terraform plans. The helper fails when a matching name/type has multiple records or points at an unexpected origin.
