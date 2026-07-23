# Incident Response

## Severity

- SEV-1: broad outage, confirmed data loss, active account compromise, or secret disclosure.
- SEV-2: major workflow unavailable, sustained SLO breach, delayed inquiries, or security control degradation.
- SEV-3: limited defect with a workaround and no material security or durability risk.

Use UTC for all incident timestamps.

## First 15 minutes

1. Assign incident commander, operations lead, and communications owner.
2. Record detection source, affected environment, commit SHA, image digest, and start time.
3. Preserve logs and traces; do not paste secrets, cookies, passkey data, TOTP secrets, raw request bodies, or signed R2 URLs into the incident channel.
4. Stop the current deployment and freeze unrelated production changes.
5. Check Cloudflare Worker errors, queue/DLQ depth, API 5xx and latency, PostgreSQL readiness and saturation, and the latest infrastructure plan.
6. Choose rollback, traffic isolation, credential rotation, or database recovery.

## Security containment

For suspected credential exposure:

1. Revoke the affected Cloudflare, HCP Terraform, R2, database, OTLP, or GitHub credential.
2. Rotate JWT and encryption secrets only with a session-invalidation and encrypted-data migration plan.
3. Revoke active staff sessions and review authentication audit events.
4. Preserve access logs and relevant database records under restricted access.
5. Patch the cause in staging, rerun the full security gates, then promote with approval.

## Recovery and closure

Confirm liveness, readiness, login/MFA, storefront list/detail, image rendering, order creation, and inquiry acceptance from an approved network. Monitor for at least 30 minutes after recovery. Close only after impact, root cause, timeline, evidence, and follow-up owners are recorded. Complete SEV-1 and SEV-2 reviews within five business days.
