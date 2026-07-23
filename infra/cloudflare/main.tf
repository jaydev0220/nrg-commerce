locals {
  resource_prefix              = var.environment == "production" ? var.project_name : "${var.project_name}-${var.environment}"
  contact_queue_name           = "${local.resource_prefix}-contact"
  contact_dead_letter_queue    = "${local.contact_queue_name}-dlq"
  product_assets_bucket_name   = "${local.resource_prefix}-product-assets"
  product_upload_bucket_name   = "${local.resource_prefix}-product-uploads"
  database_backups_bucket_name = "${local.resource_prefix}-database-backups"
}

resource "cloudflare_queue" "contact_dead_letter" {
  account_id = var.cloudflare_account_id
  queue_name = local.contact_dead_letter_queue

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_queue" "contact" {
  account_id = var.cloudflare_account_id
  queue_name = local.contact_queue_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_r2_bucket" "product_assets" {
  account_id    = var.cloudflare_account_id
  name          = local.product_assets_bucket_name
  location      = var.r2_location
  storage_class = "Standard"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_r2_bucket" "product_uploads" {
  account_id    = var.cloudflare_account_id
  name          = local.product_upload_bucket_name
  location      = var.r2_location
  storage_class = "Standard"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_r2_bucket" "database_backups" {
  account_id    = var.cloudflare_account_id
  name          = local.database_backups_bucket_name
  location      = var.r2_location
  storage_class = "Standard"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_r2_bucket_cors" "product_uploads" {
  account_id  = var.cloudflare_account_id
  bucket_name = local.product_upload_bucket_name

  rules = [{
    id = "admin-direct-upload"
    allowed = {
      methods = ["HEAD", "PUT"]
      origins = [var.admin_origin]
      headers = ["content-type"]
    }
    expose_headers  = ["etag"]
    max_age_seconds = var.upload_cors_max_age_seconds
  }]

  depends_on = [cloudflare_r2_bucket.product_uploads]
}

resource "cloudflare_r2_bucket_lifecycle" "product_uploads" {
  account_id  = var.cloudflare_account_id
  bucket_name = local.product_upload_bucket_name

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
    storage_class_transitions = []
  }]

  depends_on = [cloudflare_r2_bucket.product_uploads]
}

resource "cloudflare_r2_bucket_lifecycle" "database_backups" {
  account_id  = var.cloudflare_account_id
  bucket_name = local.database_backups_bucket_name

  rules = [{
    id      = "expire-encrypted-database-backups"
    enabled = true
    conditions = {
      prefix = "database/"
    }
    abort_multipart_uploads_transition = {
      condition = {
        max_age = 86400
        type    = "Age"
      }
    }
    delete_objects_transition = {
      condition = {
        max_age = var.backup_retention_seconds
        type    = "Age"
      }
    }
    storage_class_transitions = []
  }]

  depends_on = [cloudflare_r2_bucket.database_backups]
}

resource "cloudflare_r2_custom_domain" "product_assets" {
  count = var.public_assets_custom_domain == null ? 0 : 1

  account_id  = var.cloudflare_account_id
  bucket_name = local.product_assets_bucket_name
  domain      = var.public_assets_custom_domain.domain
  zone_id     = var.public_assets_custom_domain.zone_id
  enabled     = true
  min_tls     = "1.2"

  depends_on = [cloudflare_r2_bucket.product_assets]
}
