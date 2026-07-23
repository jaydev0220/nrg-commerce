# Release And Rollback

## Promotion

1. Confirm the release commit is on `main` and all validation and image-scan jobs succeeded.
2. Review the staging Terraform plan and Worker deployments.
3. Run the capacity and approved-network checks in the [release verification runbook](release-verification.md) against staging.
4. Review production Terraform changes, especially replacements and lifecycle changes.
5. Approve the GitHub `production` environment.
6. Deploy the API container platform to the immutable image tag for the release commit. The repository workflow publishes and scans the image but does not update the container platform.
7. Run the post-deploy verifier from an approved network and record its output, the deployed Worker version IDs, and the API image SHA.

## Worker rollback

List deployments and choose the last known good version:

```bash
pnpm --dir apps/admin exec wrangler deployments list --env production
pnpm --dir apps/admin exec wrangler rollback VERSION_ID --env production --message "incident reference" --yes
```

Repeat with `apps/catalog` or `apps/contact-worker` as needed. A rollback does not undo Terraform changes, queue messages, secrets, or database migrations.

## API rollback

Redeploy the previous immutable SHA tag from `ghcr.io/jaydev0220/nrg-commerce-api`. Do not rebuild an old source revision and call it the same release. Verify the previous image supports the current database schema before changing traffic.

## Infrastructure rollback

Do not revert Terraform by manually deleting resources. Revert the configuration in source, review a fresh plan, and apply through the production environment. Never approve replacement of a queue, bucket, or backup resource until data retention and recovery have been reviewed.

## Database changes

Prisma migrations are forward-only in production. Prefer a corrective migration. Use point-in-time recovery only when corruption or incompatible schema changes justify the data-loss tradeoff, then follow the database recovery runbook.
