# Service Level Objectives

## Availability

The monthly availability objective is **99.9%** for:

- catalog page and product-detail requests;
- storefront API reads;
- accepted inquiry submissions;
- authenticated admin API requests.

A good event is a valid request completed below the service-specific latency target without a 5xx response. Client validation failures and deliberate rate limiting are excluded; dependency failures and failed deployments are included. At 99.9%, the monthly error budget is approximately 43 minutes and 50 seconds.

## Latency

- Storefront API: p95 below 500 ms and p99 below 1.5 s.
- Admin API reads: p95 below 750 ms.
- Admin API writes: p95 below 1.5 s, excluding direct image transfer to R2.
- Contact acceptance: p95 below 750 ms. Email delivery is asynchronous and tracked separately.
- Database readiness: p95 below 250 ms when the five-second readiness cache refreshes.

Measure API objectives from OpenTelemetry server spans and platform metrics. Measure Worker objectives from Cloudflare request analytics. Do not derive availability from browser analytics alone.

## Durability

- PostgreSQL recovery point objective: 15 minutes.
- PostgreSQL recovery time objective: 60 minutes.
- Contact queue messages must either deliver or enter the dead-letter queue after bounded retries.
- Uploaded source images expire from the private bucket within 24 hours.
- Encrypted logical database backups are retained for 35 days by default.

## Alerts

Page immediately when any condition persists for five minutes:

- availability burn rate exceeds 14.4 times the monthly budget over one hour;
- API 5xx rate exceeds 5%;
- readiness fails on all replicas;
- contact DLQ depth is greater than zero;
- no successful PostgreSQL backup has completed for 26 hours.

Create a ticket when:

- six-hour burn rate exceeds 3 times budget;
- p95 latency exceeds its objective for 30 minutes;
- database pool saturation exceeds 80% for 15 minutes;
- R2, queue, or telemetry export errors recur without customer-visible impact.

## Error-budget policy

When 50% of the monthly budget is consumed, stop discretionary releases and investigate the largest contributor. When 100% is consumed, allow only reliability and security changes until the trailing 30-day window returns within objective. Every page requires an incident record with UTC timestamps and a follow-up owner.
