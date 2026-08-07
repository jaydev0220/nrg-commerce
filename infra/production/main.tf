locals {
  resource_prefix = var.project_name
  tags = {
    project     = var.project_name
    environment = "production"
    managed_by  = "terraform"
    repository  = "https://github.com/jaydev0220/nrg-commerce"
  }

  api_static_env_keys = toset([
    "NODE_ENV",
    "LOG_LEVEL",
    "TRUSTED_PROXY_CIDRS",
    "CORS_ORIGINS",
    "JWT_ISSUER",
    "JWT_AUDIENCE",
    "WEBAUTHN_RP_ID",
    "WEBAUTHN_RP_NAME",
    "WEBAUTHN_ORIGIN",
    "R2_ACCOUNT_ID",
    "R2_BUCKET_NAME",
    "R2_UPLOAD_BUCKET_NAME",
    "R2_PUBLIC_BASE_URL",
    "R2_ASSET_KEY_PREFIX",
    "DATABASE_MAX_CONNECTIONS",
    "BODY_LIMIT",
    "COOKIE_SECURE",
    "COOKIE_SAME_SITE",
    "R2_UPLOAD_URL_TTL_SECONDS",
    "STOREFRONT_CACHE_TTL_SECONDS",
    "STOREFRONT_CACHE_MAX_ENTRIES",
    "OTEL_SERVICE_NAME",
    "OTEL_METRIC_EXPORT_INTERVAL_MS"
  ])
  runtime_secret_keys = setsubtract(
    toset(nonsensitive(keys(var.runtime_secrets))),
    setunion(local.api_static_env_keys, toset(["DATABASE_URL", "DIRECT_URL"]))
  )
  generated_database_secret_keys = toset(["DATABASE_URL", "DIRECT_URL"])
  neon_owner_database_url        = "postgresql://${urlencode(neon_role.owner.name)}:${urlencode(neon_role.owner.password)}@${neon_endpoint.production.host}/nrg_commerce?sslmode=verify-full"
  neon_app_database_url          = "postgresql://${urlencode(neon_role.app.name)}:${urlencode(neon_role.app.password)}@${neon_endpoint.production.host}/nrg_commerce?sslmode=verify-full"
  neon_backup_database_url       = "postgresql://${urlencode(neon_role.backup.name)}:${urlencode(neon_role.backup.password)}@${neon_endpoint.production.host}/nrg_commerce?sslmode=verify-full"
}

data "cloudflare_zone" "production" {
  filter = {
    name   = var.domain
    status = "active"
    account = {
      id = var.cloudflare_account_id
    }
  }
}

check "cloudflare_zone_id" {
  assert {
    condition     = data.cloudflare_zone.production.id == var.cloudflare_zone_id
    error_message = "cloudflare_zone_id must identify the active production zone."
  }
}

data "cloudflare_ip_ranges" "current" {}

resource "cloudflare_zone_setting" "always_use_https" {
  zone_id    = data.cloudflare_zone.production.id
  setting_id = "always_use_https"
  value      = "on"
}

resource "cloudflare_zone_setting" "automatic_https_rewrites" {
  zone_id    = data.cloudflare_zone.production.id
  setting_id = "automatic_https_rewrites"
  value      = "on"
}

resource "cloudflare_zone_setting" "min_tls_version" {
  zone_id    = data.cloudflare_zone.production.id
  setting_id = "min_tls_version"
  value      = "1.3"
}

resource "cloudflare_zone_setting" "ssl_mode" {
  zone_id    = data.cloudflare_zone.production.id
  setting_id = "ssl"
  value      = "strict"
}

resource "cloudflare_zone_setting" "opportunistic_encryption" {
  zone_id    = data.cloudflare_zone.production.id
  setting_id = "opportunistic_encryption"
  value      = "on"
}

resource "cloudflare_dns_record" "apex_redirect" {
  zone_id = data.cloudflare_zone.production.id
  name    = "@"
  type    = "AAAA"
  content = "100::"
  ttl     = 1
  proxied = true
  comment = "Redirect apex to canonical www Worker"
}

resource "cloudflare_ruleset" "apex_to_www" {
  zone_id     = data.cloudflare_zone.production.id
  name        = "nrg-commerce-apex-to-www"
  description = "Canonicalize apex traffic to www"
  kind        = "zone"
  phase       = "http_request_dynamic_redirect"
  rules = [{
    action     = "redirect"
    expression = "(http.host eq \"${var.domain}\")"
    ref        = "apex-to-www"
    action_parameters = {
      from_value = {
        status_code = 301
        target_url = {
          expression = "concat(\"https://www.${var.domain}\", http.request.uri.path)"
        }
        preserve_query_string = true
      }
    }
    enabled = true
  }]
}

import {
  to = cloudflare_ruleset.apex_to_www
  id = "zones/${var.cloudflare_zone_id}/9400b85150d84175ab1b1b16e4544e3d"
}

resource "cloudflare_queue" "contact_dlq" {
  account_id = var.cloudflare_account_id
  queue_name = "${local.resource_prefix}-contact-dlq"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_queue" "contact" {
  account_id = var.cloudflare_account_id
  queue_name = "${local.resource_prefix}-contact"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_r2_bucket" "product_assets" {
  account_id    = var.cloudflare_account_id
  name          = "${local.resource_prefix}-product-assets"
  location      = "apac"
  storage_class = "Standard"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_r2_bucket" "product_uploads" {
  account_id    = var.cloudflare_account_id
  name          = "${local.resource_prefix}-product-uploads"
  location      = "apac"
  storage_class = "Standard"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_r2_bucket" "database_backups" {
  account_id    = var.cloudflare_account_id
  name          = "${local.resource_prefix}-database-backups"
  location      = "apac"
  storage_class = "InfrequentAccess"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_r2_managed_domain" "product_assets" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.product_assets.name
  enabled     = false
}

resource "cloudflare_r2_managed_domain" "product_uploads" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.product_uploads.name
  enabled     = false
}

resource "cloudflare_r2_managed_domain" "database_backups" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.database_backups.name
  enabled     = false
}

resource "aws_s3_bucket_cors_configuration" "product_uploads" {
  provider = aws.r2
  bucket   = cloudflare_r2_bucket.product_uploads.name
  cors_rule {
    allowed_methods = ["PUT", "HEAD"]
    allowed_origins = ["https://admin.${var.domain}"]
    allowed_headers = ["content-type"]
    expose_headers  = ["etag"]
    max_age_seconds = var.upload_cors_max_age_seconds
  }
}

resource "cloudflare_r2_bucket_lifecycle" "product_uploads" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.product_uploads.name
  rules = [{
    id      = "expire-abandoned-uploads"
    enabled = true
    conditions = {
      prefix = ""
    }
    abort_multipart_uploads_transition = {
      condition = {
        max_age = var.upload_retention_seconds
        type    = "Age"
      }
    }
    delete_objects_transition = {
      condition = {
        max_age = var.upload_retention_seconds
        type    = "Age"
      }
    }
  }]
}

resource "cloudflare_r2_bucket_lifecycle" "database_backups" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.database_backups.name
  rules = [{
    id      = "expire-database-backups"
    enabled = true
    conditions = {
      prefix = "database/"
    }
    delete_objects_transition = {
      condition = {
        max_age = var.backup_retention_days * 86400
        type    = "Age"
      }
    }
  }]
}

resource "cloudflare_r2_bucket_lock" "database_backups" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.database_backups.name
  rules = [{
    id      = "seven-day-database-backup-retention"
    enabled = true
    prefix  = "database/"
    condition = {
      type            = "Age"
      max_age_seconds = var.backup_object_lock_days * 86400
    }
  }]
}

resource "cloudflare_r2_custom_domain" "cdn" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.product_assets.name
  domain      = "cdn.${var.domain}"
  zone_id     = data.cloudflare_zone.production.id
  enabled     = true
  min_tls     = "1.3"
}

resource "cloudflare_turnstile_widget" "production" {
  account_id = var.cloudflare_account_id
  name       = "${local.resource_prefix}-production"
  mode       = "managed"
  domains    = ["www.${var.domain}", "catalog.${var.domain}"]
}

resource "azurerm_resource_group" "production" {
  name     = "rg-${local.resource_prefix}"
  location = var.azure_location
  tags     = local.tags
}

resource "azurerm_log_analytics_workspace" "production" {
  name                = "log-${local.resource_prefix}"
  location            = azurerm_resource_group.production.location
  resource_group_name = azurerm_resource_group.production.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

resource "azurerm_user_assigned_identity" "certificate_reader" {
  name                = "id-${local.resource_prefix}-certificate"
  location            = azurerm_resource_group.production.location
  resource_group_name = azurerm_resource_group.production.name
  tags                = local.tags
}

resource "azurerm_user_assigned_identity" "runtime_reader" {
  name                = "id-${local.resource_prefix}-runtime"
  location            = azurerm_resource_group.production.location
  resource_group_name = azurerm_resource_group.production.name
  tags                = local.tags
}

# trivy:ignore:AZU-0013 GitHub-hosted release runners require public Key Vault access; OIDC and RBAC still gate every operation.
resource "azurerm_key_vault" "production" {
  name                          = "kv-${local.resource_prefix}-${random_string.key_vault.result}"
  location                      = azurerm_resource_group.production.location
  resource_group_name           = azurerm_resource_group.production.name
  tenant_id                     = var.azure_tenant_id
  sku_name                      = "standard"
  purge_protection_enabled      = true
  soft_delete_retention_days    = 90
  rbac_authorization_enabled    = true
  public_network_access_enabled = true
  tags                          = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "random_string" "key_vault" {
  length  = 6
  lower   = true
  numeric = true
  special = false
}

resource "azurerm_role_assignment" "certificate_reader" {
  scope                = azurerm_key_vault.production.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.certificate_reader.principal_id
}

resource "azurerm_role_assignment" "runtime_reader" {
  scope                = azurerm_key_vault.production.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.runtime_reader.principal_id
}

resource "azurerm_key_vault_secret" "runtime" {
  for_each     = local.runtime_secret_keys
  name         = lower(replace(each.key, "_", "-"))
  value        = var.runtime_secrets[each.key]
  key_vault_id = azurerm_key_vault.production.id
  content_type = "nrg-commerce production runtime secret"
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [value]
  }
}

resource "azurerm_key_vault_secret" "database_url" {
  name         = "database-url"
  value        = local.neon_app_database_url
  key_vault_id = azurerm_key_vault.production.id
  content_type = "nrg-commerce production generated database URL"

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [value]
  }
}

resource "azurerm_key_vault_secret" "direct_url" {
  name         = "direct-url"
  value        = local.neon_app_database_url
  key_vault_id = azurerm_key_vault.production.id
  content_type = "nrg-commerce production generated direct database URL"

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [value]
  }
}

resource "azurerm_container_app_environment" "production" {
  name                       = "cae-${local.resource_prefix}"
  location                   = azurerm_resource_group.production.location
  resource_group_name        = azurerm_resource_group.production.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.production.id
  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
  }
  tags = local.tags
}

resource "azapi_resource" "origin_certificate" {
  count     = var.origin_certificate_enabled && var.bootstrap_phase != "phase-1-base" ? 1 : 0
  type      = "Microsoft.App/managedEnvironments/certificates@2025-07-01"
  name      = var.origin_certificate_name
  parent_id = azurerm_container_app_environment.production.id
  body = {
    properties = {
      certificateKeyVaultProperties = {
        identity    = azurerm_user_assigned_identity.certificate_reader.id
        keyVaultUrl = "${trimsuffix(azurerm_key_vault.production.vault_uri, "/")}/secrets/${var.origin_certificate_name}"
      }
    }
  }
  depends_on = [azurerm_role_assignment.certificate_reader]
}

resource "azurerm_container_app" "api" {
  count                        = var.bootstrap_phase == "phase-1-base" ? 0 : 1
  name                         = "ca-${local.resource_prefix}-api"
  container_app_environment_id = azurerm_container_app_environment.production.id
  resource_group_name          = azurerm_resource_group.production.name
  revision_mode                = "Multiple"
  max_inactive_revisions       = 5

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.runtime_reader.id]
  }

  ingress {
    external_enabled = true
    target_port      = 8080
    transport        = "auto"
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
    dynamic "ip_security_restriction" {
      for_each = toset(
        concat(data.cloudflare_ip_ranges.current.ipv4_cidrs, data.cloudflare_ip_ranges.current.ipv6_cidrs)
      )
      content {
        name             = "cloudflare-${replace(replace(ip_security_restriction.value, "/", "-"), ":", "-")}"
        action           = "Allow"
        ip_address_range = ip_security_restriction.value
        description      = "Cloudflare edge range"
      }
    }
  }

  template {
    min_replicas = 0
    max_replicas = 1
    container {
      name   = "api"
      image  = var.api_image
      cpu    = 0.25
      memory = "0.5Gi"
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "LOG_LEVEL"
        value = "info"
      }
      env {
        name  = "TRUSTED_PROXY_CIDRS"
        value = join(",", length(var.trusted_proxy_cidrs) > 0 ? var.trusted_proxy_cidrs : concat(data.cloudflare_ip_ranges.current.ipv4_cidrs, data.cloudflare_ip_ranges.current.ipv6_cidrs))
      }
      env {
        name  = "CORS_ORIGINS"
        value = "https://admin.${var.domain},https://catalog.${var.domain},https://www.${var.domain}"
      }
      env {
        name  = "JWT_ISSUER"
        value = "https://api.${var.domain}"
      }
      env {
        name  = "JWT_AUDIENCE"
        value = "nrg-commerce-admin"
      }
      env {
        name  = "WEBAUTHN_RP_ID"
        value = var.domain
      }
      env {
        name  = "WEBAUTHN_RP_NAME"
        value = "NRG Commerce"
      }
      env {
        name  = "WEBAUTHN_ORIGIN"
        value = "https://admin.${var.domain}"
      }
      env {
        name  = "R2_ACCOUNT_ID"
        value = var.cloudflare_account_id
      }
      env {
        name  = "R2_BUCKET_NAME"
        value = cloudflare_r2_bucket.product_assets.name
      }
      env {
        name  = "R2_UPLOAD_BUCKET_NAME"
        value = cloudflare_r2_bucket.product_uploads.name
      }
      env {
        name  = "R2_PUBLIC_BASE_URL"
        value = "https://cdn.${var.domain}"
      }
      env {
        name  = "R2_ASSET_KEY_PREFIX"
        value = "products/skus"
      }
      env {
        name  = "DATABASE_MAX_CONNECTIONS"
        value = "10"
      }
      env {
        name  = "BODY_LIMIT"
        value = "64kb"
      }
      env {
        name  = "COOKIE_SECURE"
        value = "true"
      }
      env {
        name  = "COOKIE_SAME_SITE"
        value = "none"
      }
      env {
        name  = "R2_UPLOAD_URL_TTL_SECONDS"
        value = "900"
      }
      env {
        name  = "STOREFRONT_CACHE_TTL_SECONDS"
        value = "60"
      }
      env {
        name  = "STOREFRONT_CACHE_MAX_ENTRIES"
        value = "500"
      }
      env {
        name  = "OTEL_SERVICE_NAME"
        value = "nrg-commerce-api"
      }
      env {
        name  = "OTEL_METRIC_EXPORT_INTERVAL_MS"
        value = "60000"
      }
      dynamic "env" {
        for_each = setunion(local.runtime_secret_keys, local.generated_database_secret_keys)
        content {
          name        = env.key
          secret_name = lower(replace(env.key, "_", "-"))
        }
      }
      liveness_probe {
        transport        = "HTTP"
        port             = 8080
        path             = "/health/liveness"
        interval_seconds = 30
        timeout          = 5
      }
      readiness_probe {
        transport        = "HTTP"
        port             = 8080
        path             = "/health/readiness"
        interval_seconds = 10
        timeout          = 5
      }
    }
  }
  dynamic "secret" {
    for_each = setunion(local.runtime_secret_keys, local.generated_database_secret_keys)
    content {
      name                = lower(replace(secret.key, "_", "-"))
      key_vault_secret_id = contains(local.generated_database_secret_keys, secret.key) ? (secret.key == "DATABASE_URL" ? azurerm_key_vault_secret.database_url.versionless_id : azurerm_key_vault_secret.direct_url.versionless_id) : azurerm_key_vault_secret.runtime[secret.key].versionless_id
      identity            = azurerm_user_assigned_identity.runtime_reader.id
    }
  }

  lifecycle {
    ignore_changes = [template[0].container[0].image, ingress[0].traffic_weight]
  }
  depends_on = [azurerm_role_assignment.runtime_reader]
  tags       = local.tags
}

resource "azurerm_container_app_custom_domain" "api" {
  count                                    = var.origin_certificate_enabled && var.bootstrap_phase != "phase-1-base" ? 1 : 0
  name                                     = "api.${var.domain}"
  container_app_id                         = azurerm_container_app.api[0].id
  container_app_environment_certificate_id = azapi_resource.origin_certificate[0].id
  certificate_binding_type                 = "SniEnabled"
  depends_on                               = [cloudflare_dns_record.api_verification]
}

resource "cloudflare_dns_record" "api" {
  count   = var.bootstrap_phase == "phase-1-base" ? 0 : 1
  zone_id = data.cloudflare_zone.production.id
  name    = "api.${var.domain}"
  type    = "CNAME"
  content = trimsuffix(azurerm_container_app.api[0].ingress[0].fqdn, ".")
  proxied = var.enable_cloudflare_proxy
  ttl     = 1
  comment = "Azure Container App API origin"
}

resource "cloudflare_dns_record" "api_verification" {
  count   = var.bootstrap_phase == "phase-1-base" ? 0 : 1
  zone_id = data.cloudflare_zone.production.id
  name    = "asuid.api.${var.domain}"
  type    = "TXT"
  content = azurerm_container_app.api[0].custom_domain_verification_id
  proxied = false
  ttl     = 300
  comment = "Azure Container App custom-domain validation"
}

resource "azurerm_consumption_budget_resource_group" "production" {
  name              = "${local.resource_prefix}-monthly"
  resource_group_id = azurerm_resource_group.production.id
  amount            = var.azure_budget_amount
  time_grain        = "Monthly"
  time_period {
    start_date = formatdate("YYYY-MM-01'T'00:00:00Z", plantimestamp())
    end_date   = "2036-01-01T00:00:00Z"
  }
  lifecycle {
    ignore_changes = [time_period[0].start_date]
  }
  notification {
    enabled        = true
    operator       = "GreaterThan"
    threshold      = 50
    threshold_type = "Actual"
    contact_emails = ["contact@nrglabware.com"]
  }
  notification {
    enabled        = true
    operator       = "GreaterThan"
    threshold      = 80
    threshold_type = "Actual"
    contact_emails = ["contact@nrglabware.com"]
  }
  notification {
    enabled        = true
    operator       = "GreaterThan"
    threshold      = 100
    threshold_type = "Actual"
    contact_emails = ["contact@nrglabware.com"]
  }
}

resource "neon_project" "production" {
  name                      = var.project_name
  org_id                    = var.neon_org_id
  region_id                 = "aws-ap-southeast-1"
  pg_version                = 18
  history_retention_seconds = 21600
  store_password            = "yes"
  default_branch_protected  = true
  default_endpoint_settings {
    autoscaling_limit_min_cu = 0.25
    autoscaling_limit_max_cu = 1
  }
}

resource "neon_branch" "production" {
  project_id = neon_project.production.id
  name       = "production"
  protected  = "yes"
}

resource "neon_endpoint" "production" {
  project_id               = neon_project.production.id
  branch_id                = neon_branch.production.id
  region_id                = "aws-ap-southeast-1"
  autoscaling_limit_min_cu = 0.25
  autoscaling_limit_max_cu = 1
  type                     = "read_write"
}

resource "neon_database" "production" {
  project_id = neon_project.production.id
  branch_id  = neon_branch.production.id
  name       = "nrg_commerce"
  owner_name = "nrg_commerce_owner"

  depends_on = [neon_role.owner]
}

resource "neon_role" "owner" {
  project_id = neon_project.production.id
  branch_id  = neon_branch.production.id
  name       = "nrg_commerce_owner"
}

resource "neon_role" "app" {
  project_id = neon_project.production.id
  branch_id  = neon_branch.production.id
  name       = "nrg_commerce_app"
}

resource "neon_role" "backup" {
  project_id = neon_project.production.id
  branch_id  = neon_branch.production.id
  name       = "nrg_commerce_backup"
}

resource "postgresql_grant" "app_schema" {
  provider    = postgresql.owner
  database    = "nrg_commerce"
  role        = neon_role.app.name
  schema      = "public"
  object_type = "schema"
  privileges  = ["USAGE"]
  count       = var.neon_owner_database_url == "" ? 0 : 1
}

resource "postgresql_grant" "backup_schema" {
  provider    = postgresql.owner
  database    = "nrg_commerce"
  role        = neon_role.backup.name
  schema      = "public"
  object_type = "schema"
  privileges  = ["USAGE"]
  count       = var.neon_owner_database_url == "" ? 0 : 1
}

resource "postgresql_default_privileges" "app_tables" {
  provider    = postgresql.owner
  database    = "nrg_commerce"
  role        = neon_role.owner.name
  owner       = neon_role.owner.name
  schema      = "public"
  object_type = "table"
  privileges  = ["SELECT", "INSERT", "UPDATE", "DELETE"]
  count       = var.neon_owner_database_url == "" ? 0 : 1
}

resource "postgresql_default_privileges" "app_sequences" {
  provider    = postgresql.owner
  database    = "nrg_commerce"
  role        = neon_role.owner.name
  owner       = neon_role.owner.name
  schema      = "public"
  object_type = "sequence"
  privileges  = ["USAGE", "SELECT", "UPDATE"]
  count       = var.neon_owner_database_url == "" ? 0 : 1
}

resource "postgresql_default_privileges" "backup_tables" {
  provider    = postgresql.owner
  database    = "nrg_commerce"
  role        = neon_role.backup.name
  owner       = neon_role.owner.name
  schema      = "public"
  object_type = "table"
  privileges  = ["SELECT"]
  count       = var.neon_owner_database_url == "" ? 0 : 1
}

resource "postgresql_default_privileges" "backup_sequences" {
  provider    = postgresql.owner
  database    = "nrg_commerce"
  role        = neon_role.backup.name
  owner       = neon_role.owner.name
  schema      = "public"
  object_type = "sequence"
  privileges  = ["SELECT"]
  count       = var.neon_owner_database_url == "" ? 0 : 1
}
