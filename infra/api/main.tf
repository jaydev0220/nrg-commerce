locals {
  comment_prefix          = "nrg-commerce ${var.environment} API"
  origin_certificate_name = "api-origin-${var.environment}"
}

resource "azurerm_resource_group" "api" {
  name     = var.azure_resource_group
  location = var.azure_location
}

resource "azurerm_container_app_environment" "api" {
  name                = var.azure_container_app_environment
  location            = azurerm_resource_group.api.location
  resource_group_name = azurerm_resource_group.api.name
}

resource "azurerm_container_app" "api" {
  name                         = var.azure_container_app_name
  container_app_environment_id = azurerm_container_app_environment.api.id
  resource_group_name          = azurerm_resource_group.api.name
  revision_mode                = "Multiple"

  ingress {
    external_enabled = true
    target_port      = 8080
    transport        = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 0
    max_replicas = 1

    container {
      name   = "api"
      image  = var.bootstrap_image
      cpu    = 0.25
      memory = "0.5Gi"
    }
  }

  lifecycle {
    # CI owns revision templates, runtime secrets, ingress restrictions, and traffic shifting.
    ignore_changes = [template, secret, ingress]
  }
}

resource "azurerm_container_app_environment_certificate" "api_origin" {
  name                         = local.origin_certificate_name
  container_app_environment_id = azurerm_container_app_environment.api.id
  certificate_blob_base64      = var.origin_certificate_pfx_base64
  certificate_password         = var.origin_certificate_password
}

resource "cloudflare_dns_record" "api_cname" {
  zone_id = var.cloudflare_zone_id
  name    = var.api_domain
  type    = "CNAME"
  content = trimsuffix(azurerm_container_app.api.ingress[0].fqdn, ".")
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
  content = azurerm_container_app.api.custom_domain_verification_id
  proxied = false
  ttl     = 300
  comment = "${local.comment_prefix} Azure domain verification"

  lifecycle {
    prevent_destroy = true
  }
}
