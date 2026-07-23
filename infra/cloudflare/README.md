# Cloudflare Infrastructure

Terraform owns durable Cloudflare dependencies only:

- one contact queue and dead-letter queue per environment;
- separate public product-assets and private direct-upload R2 buckets;
- a private bucket with retention policy for client-side-encrypted database backups;
- restrictive upload-bucket CORS;
- automatic cleanup of abandoned uploads;
- an optional custom domain for public assets.

Wrangler owns Worker scripts, custom Worker domains, bindings, secrets, and the contact queue consumer. Do not add those resources to Terraform.

## HCP Terraform

Use one HCP Terraform workspace per environment, for example:

- `nrg-commerce-staging`
- `nrg-commerce-production`

The configuration uses an empty `cloud {}` block so CI supplies workspace selection without committing account metadata. Configure both workspaces for local execution so provider credentials remain in the GitHub runner while HCP Terraform stores and locks state.

Required CI environment values:

```text
CLOUDFLARE_API_TOKEN
HCP_TERRAFORM_TOKEN
TF_CLOUD_ORGANIZATION
TF_CLOUD_PROJECT
TF_WORKSPACE
TF_VAR_admin_origin
TF_VAR_cloudflare_account_id
TF_VAR_environment
```

Set `TF_VAR_public_assets_custom_domain` to a Terraform object when the CDN domain should be managed:

```text
{"domain":"cdn.example.com","zone_id":"0123456789abcdef0123456789abcdef"}
```

The Cloudflare token needs account-level Workers Queues and R2 write access, plus zone DNS/R2 custom-domain access only when `public_assets_custom_domain` is set.

## Local validation

```bash
export TF_CLOUD_ORGANIZATION=...
export TF_CLOUD_PROJECT=...
export TF_WORKSPACE=...
export TF_VAR_environment=staging
export TF_VAR_cloudflare_account_id=...
export TF_VAR_admin_origin=https://admin-staging.example.com
terraform -chdir=infra/cloudflare init
terraform -chdir=infra/cloudflare validate
terraform -chdir=infra/cloudflare plan
```

Use `terraform import` before the first production plan when a named resource already exists. Never apply a replacement plan for a stateful production resource without reviewing the retained data and rollback path.

Queues and R2 buckets use `prevent_destroy`. Terraform will reject a plan that destroys or replaces them. Treat that failure as a data-protection control: investigate the proposed replacement and import or move state when appropriate. Removing the lifecycle guard requires a separately reviewed change, a verified backup or drain procedure, and explicit approval from the production owner.
