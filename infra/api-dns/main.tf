locals {
  comment_prefix = "nrg-commerce ${var.environment} API"
}

resource "cloudflare_dns_record" "api_cname" {
  zone_id = var.cloudflare_zone_id
  name    = var.api_domain
  type    = "CNAME"
  content = trimsuffix(var.container_app_hostname, ".")
  proxied = var.proxied
  ttl     = 1
  comment = "${local.comment_prefix} origin"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_dns_record" "api_verification" {
  zone_id = var.cloudflare_zone_id
  name    = "asuid.${var.api_domain}"
  type    = "TXT"
  content = var.custom_domain_verification_id
  proxied = false
  ttl     = 300
  comment = "${local.comment_prefix} Azure domain verification"

  lifecycle {
    prevent_destroy = true
  }
}
