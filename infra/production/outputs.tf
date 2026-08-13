output "cloudflare_zone_id" {
  value = data.cloudflare_zone.production.id
}

output "turnstile_site_key" {
  value = cloudflare_turnstile_widget.production.sitekey
}

output "turnstile_secret_key" {
  value     = cloudflare_turnstile_widget.production.secret
  sensitive = true
}

output "resource_group_name" {
  value = azurerm_resource_group.production.name
}

output "api_fqdn" {
  value = try(azurerm_container_app.api[0].ingress[0].fqdn, "")
}

output "origin_certificate_expiration_date" {
  value = try(azurerm_container_app_environment_certificate.origin[0].expiration_date, "")
}

output "bootstrap_phase" {
  value = var.bootstrap_phase
}

output "bootstrap_complete" {
  value = var.bootstrap_phase == "production" || var.bootstrap_phase == "phase-3-proxy"
}

output "neon_project_id" {
  value = neon_project.production.id
}

output "neon_production_branch_id" {
  value = neon_branch.production.id
}

output "cloudflare_proxy_cidrs" {
  value = concat(data.cloudflare_ip_ranges.current.ipv4_cidrs, data.cloudflare_ip_ranges.current.ipv6_cidrs)
}

output "neon_owner_database_url" {
  value     = local.neon_owner_database_url
  sensitive = true
}

output "neon_app_database_url" {
  value     = local.neon_app_database_url
  sensitive = true
}

output "neon_backup_database_url" {
  value     = local.neon_backup_database_url
  sensitive = true
}

output "r2_bucket_names" {
  value = {
    assets  = cloudflare_r2_bucket.product_assets.name
    uploads = cloudflare_r2_bucket.product_uploads.name
    backups = cloudflare_r2_bucket.database_backups.name
  }
}
