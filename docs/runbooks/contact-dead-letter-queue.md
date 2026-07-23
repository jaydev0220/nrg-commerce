# Contact Dead-Letter Queue

An inquiry is acknowledged only after Cloudflare Queues accepts it. Delivery retries five times before the message enters the environment's dead-letter queue.

## Response

1. Treat any DLQ depth above zero as a SEV-2 until scope is known.
2. Check contact Worker logs for provider rejection, invalid sender configuration, rate limits, and permanent recipient errors.
3. Verify Email Routing and sender authorization without logging message contents.
4. Correct configuration or provider availability in staging first.
5. Export affected messages through a temporary, access-controlled consumer or the Cloudflare dashboard. Limit access because inquiries contain personal data.
6. Replay only messages that have not already delivered; use the message ID and delivery logs to prevent duplicate email.
7. Remove temporary consumers and retained exports after resolution.
8. Record count, oldest message age, root cause, replay count, and deletion evidence.

Never post inquiry bodies into tickets or chat. Do not purge the DLQ until successful delivery or a documented permanent-failure decision.
