variable "cloudflare_account_id" {
  description = "Cloudflare account that owns the Workers, Queues, and R2 buckets."
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{32}$", var.cloudflare_account_id))
    error_message = "cloudflare_account_id must be a 32-character lowercase hexadecimal account ID."
  }
}

variable "environment" {
  description = "Deployment environment."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "project_name" {
  description = "Stable prefix used for Cloudflare resource names."
  type        = string
  default     = "nrg-commerce"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$", var.project_name))
    error_message = "project_name must be a lowercase, hyphenated name between 3 and 63 characters."
  }
}

variable "admin_origin" {
  description = "Exact HTTPS origin allowed to upload product images."
  type        = string

  validation {
    condition     = can(regex("^https://[^/?#]+$", var.admin_origin))
    error_message = "admin_origin must be an HTTPS origin without a path, query, fragment, or trailing slash."
  }
}

variable "r2_location" {
  description = "Cloudflare R2 location hint."
  type        = string
  default     = "apac"

  validation {
    condition     = contains(["apac", "eeur", "enam", "oc", "weur", "wnam"], var.r2_location)
    error_message = "r2_location must be one of apac, eeur, enam, oc, weur, or wnam."
  }
}

variable "upload_retention_seconds" {
  description = "Maximum age of abandoned objects in the private upload bucket."
  type        = number
  default     = 86400

  validation {
    condition = (
      var.upload_retention_seconds >= 3600 &&
      var.upload_retention_seconds <= 604800 &&
      floor(var.upload_retention_seconds) == var.upload_retention_seconds
    )
    error_message = "upload_retention_seconds must be an integer between one hour and seven days."
  }
}

variable "upload_cors_max_age_seconds" {
  description = "Browser preflight cache duration for direct uploads."
  type        = number
  default     = 3600

  validation {
    condition = (
      var.upload_cors_max_age_seconds >= 0 &&
      var.upload_cors_max_age_seconds <= 86400 &&
      floor(var.upload_cors_max_age_seconds) == var.upload_cors_max_age_seconds
    )
    error_message = "upload_cors_max_age_seconds must be an integer from 0 through 86400."
  }
}

variable "backup_retention_seconds" {
  description = "Maximum age of encrypted logical database backups."
  type        = number
  default     = 3024000

  validation {
    condition = (
      var.backup_retention_seconds >= 604800 &&
      var.backup_retention_seconds <= 31536000 &&
      floor(var.backup_retention_seconds) == var.backup_retention_seconds
    )
    error_message = "backup_retention_seconds must be an integer between 7 and 365 days."
  }
}

variable "public_assets_custom_domain" {
  description = "Optional custom domain configuration for the public product-assets bucket."
  type = object({
    domain  = string
    zone_id = string
  })
  default = null

  validation {
    condition = var.public_assets_custom_domain == null || (
      can(regex("^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$", var.public_assets_custom_domain.domain)) &&
      can(regex("^[0-9a-f]{32}$", var.public_assets_custom_domain.zone_id))
    )
    error_message = "The custom domain must be a hostname and zone_id must be a 32-character lowercase hexadecimal ID."
  }
}
