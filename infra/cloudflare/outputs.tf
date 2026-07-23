output "contact_queue_name" {
  description = "Queue name used by the contact Worker producer and consumer."
  value       = cloudflare_queue.contact.queue_name
}

output "contact_dead_letter_queue_name" {
  description = "Dead-letter queue name used after contact delivery retries are exhausted."
  value       = cloudflare_queue.contact_dead_letter.queue_name
}

output "product_assets_bucket_name" {
  description = "Public product-image bucket used by apps/api."
  value       = cloudflare_r2_bucket.product_assets.name
}

output "product_upload_bucket_name" {
  description = "Private, short-lived direct-upload bucket used by apps/api."
  value       = cloudflare_r2_bucket.product_uploads.name
}

output "database_backups_bucket_name" {
  description = "Private bucket for client-side-encrypted logical PostgreSQL backups."
  value       = cloudflare_r2_bucket.database_backups.name
}

output "public_assets_domain" {
  description = "Configured custom domain for product assets, when enabled."
  value       = var.public_assets_custom_domain == null ? null : var.public_assets_custom_domain.domain
}
