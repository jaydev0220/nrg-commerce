# API Infrastructure

This Terraform root owns the stable API infrastructure shared across releases: the Azure resource group, Container Apps environment, Container App foundation, origin certificate, and Cloudflare API DNS records.

Use one HCP Terraform workspace per environment. Existing workspace names such as `nrg-commerce-api-dns-staging` and `nrg-commerce-api-dns-production` can remain unchanged because renaming the Terraform root does not require renaming remote workspaces.

CI still owns release orchestration: runtime secrets and environment variables, immutable revision updates, health probes, Cloudflare IP ingress restrictions, custom-domain binding, health checks, and traffic switching.

The API CNAME remains proxied through Cloudflare during normal operation. If Azure requires direct CNAME validation while binding the custom hostname, CI temporarily applies `TF_VAR_proxied=false` and restores the proxied state immediately afterward.

The deployment requires the environment-scoped GitHub secrets `API_ORIGIN_CERTIFICATE_PFX_BASE64` and `API_ORIGIN_CERTIFICATE_PASSWORD`. The PFX must contain the private key and a certificate valid for `API_DOMAIN`; a Cloudflare Origin CA certificate is appropriate because the origin only accepts Cloudflare traffic.

Existing Azure resources and matching Cloudflare DNS records are imported into Terraform state before the first migration plan when needed.
