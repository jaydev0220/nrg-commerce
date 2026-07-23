# Production Readiness

## Runtime topology

- `apps/landing`: prerendered Cloudflare Workers Static Assets site with no runtime Worker entry point.
- `apps/admin`, `apps/catalog`, and `apps/contact-worker`: Cloudflare Workers.
- `apps/api`: portable OCI image from `ghcr.io/jaydev0220/nrg-commerce-api`.
- PostgreSQL: managed PostgreSQL 18 with point-in-time recovery.
- Cloudflare Queues and R2: managed by `infra/cloudflare` with HCP Terraform state.

Wrangler owns Worker code, domains, bindings, and secrets. Terraform owns queues and buckets. Keep that ownership split to prevent configuration drift.

## Release controls

1. Protect `main`; require the `Validate monorepo` and dependency-review checks.
2. Create GitHub Environments named `staging` and `production`.
3. Require reviewers for `production`; do not require approval for `staging`.
4. Configure separate HCP Terraform workspaces and separate Cloudflare resource names per environment.
5. Deploy only from a commit on `main`. The workflow validates, audits, scans the API image, applies staging infrastructure, deploys all staging Workers and landing assets, then requests production approval.
6. Do not bypass a failed migration, dependency audit, container scan, coverage threshold, or Terraform plan.
7. Record the commit SHA, approver, migration result, and rollback decision in the release record.

`SHADOW_DATABASE_URL` must identify a separate, disposable database created only for migration
drift checks. Never point it at the application database, the migration maintenance database, or
any production database.

The workflow publishes the API container as the immutable tag `ghcr.io/jaydev0220/nrg-commerce-api:<commit-sha>` after production-environment approval and scans that exact registry artifact. It does not deploy the API. The container platform must be updated separately to the exact SHA tag; never deploy a mutable tag.

Public HTTP smoke tests are intentionally not run from GitHub-hosted runners because edge policy blocks that traffic. Use provider deployment results in CI and run the authenticated checks in the [release verification runbook](../runbooks/release-verification.md) from an approved network after promotion.

## GitHub Environment values

Configure these variables separately for `staging` and `production`:

```text
ADMIN_API_BASE_URL
ADMIN_DOMAIN
CATALOG_API_BASE_URL
CATALOG_DOMAIN
CDN_BASE_URL
COOKIE_DOMAIN
FACEBOOK_URL
LANDING_DOMAIN
LANDING_SITE_URL
LINE_URL
TF_CLOUD_ORGANIZATION
TF_CLOUD_PROJECT
TF_PUBLIC_ASSETS_CUSTOM_DOMAIN
TF_WORKSPACE
TURNSTILE_SITE_KEY
```

`LANDING_DOMAIN` is the hostname-only custom domain and must match the hostname in `LANDING_SITE_URL` for that environment.

`TF_PUBLIC_ASSETS_CUSTOM_DOMAIN` is optional. When set, use:

```text
{"domain":"cdn.example.com","zone_id":"0123456789abcdef0123456789abcdef"}
```

Configure these environment secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
CONTACT_ALLOWED_ORIGINS
CONTACT_RECIPIENT_EMAIL
CONTACT_SENDER_EMAIL
HCP_TERRAFORM_TOKEN
TURNSTILE_SECRET_KEY
```

Use least-privilege, environment-specific tokens. Contact sender and recipient values are secrets because they contain operational addresses.

## API production configuration

Load secrets through the container platform secret manager. Do not bake them into the image or pass them as build arguments. Start from [`apps/api/.env.example`](../../apps/api/.env.example) and ensure:

- `NODE_ENV=production`, secure cookies, and exact HTTPS CORS/WebAuthn origins;
- distinct random authentication and encryption secrets of at least 32 characters;
- a pooled application `DATABASE_URL` with `sslmode=verify-full`; reserve a similarly secured
  `DIRECT_URL` for migrations and backup tooling;
- the database provider's root CA mounted read-only when it is not in the image trust store, with
  its URL-encoded path supplied as `sslrootcert` in both database URLs; obtain this certificate
  through the authenticated provider control plane and verify its fingerprint before deployment;
- separate public-assets and private-upload R2 buckets;
- `OTEL_EXPORTER_OTLP_ENDPOINT` and secret collector headers;
- container liveness at `/health/liveness` and readiness at `/health/readiness`;
- at least two replicas where the hosting platform and workload permit it.

Run the container with a read-only root filesystem, all Linux capabilities dropped, privilege escalation disabled, a bounded memory/CPU allocation, and a writable temporary filesystem only when the platform requires one. Keep the image's numeric non-root user. Configure the platform to stop routing traffic before `SIGTERM` and allow at least eight seconds for graceful shutdown.

The in-process API rate limiter is a last line of defense and is not shared between replicas. Configure distributed edge or gateway limits for authentication, management writes, uploads, and storefront traffic before exposing the API publicly. Preserve the exact client IP through the trusted proxy chain and set `TRUST_PROXY_HOPS` to that verified chain length; an incorrect value can let clients evade IP-based controls.

Create the first administrator with `pnpm --filter @apps/api bootstrap:admin` from an approved operator host after the production build and migration complete. Supply the generated initial password through a protected channel, require immediate password change and MFA enrollment, and never place the password in shell history, CI logs, tickets, or repository files.

Expired or revoked authentication sessions, including their IP address and user-agent metadata, are removed 30 days after they become inactive. Do not disable the API maintenance process without scheduling an equivalent cleanup job.

The target capacity is 100 storefront requests/second, 20 concurrent staff, and 5 inquiries/second with a two-times burst. Run the guarded capacity test in the [release verification runbook](../runbooks/release-verification.md) before the first launch and after database-query, cache, image, or rate-limit changes.

## Launch gate

Production publication requires all of the following:

- clean repository validation, coverage, E2E, migration integration, Terraform validation, and image scan;
- a staging deployment from the exact release commit;
- successful database backup and a restore drill completed within the prior quarter;
- dashboards and paging routes receiving API and Cloudflare telemetry;
- distributed edge or gateway rate limits validated across multiple API replicas;
- current incident, rollback, database recovery, and contact-DLQ ownership;
- no unresolved critical or high security finding;
- post-deploy liveness, readiness, login, storefront list/detail, image load, and inquiry acceptance checks from an approved network.

Retain the capacity and post-deploy verifier output with the release record. Neither command prints passwords, cookies, Turnstile tokens, or response bodies.
