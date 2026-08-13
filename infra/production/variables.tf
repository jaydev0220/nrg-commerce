variable "project_name" {
  type        = string
  default     = "nrg-commerce"
  description = "Stable resource prefix."
}

variable "bootstrap_phase" {
  type        = string
  default     = "production"
  description = "Bootstrap phase. Production releases use the fully provisioned state."
  validation {
    condition     = contains(["production", "phase-1-base", "phase-2-api", "phase-3-proxy"], var.bootstrap_phase)
    error_message = "bootstrap_phase must be production or a supported bootstrap phase."
  }
}

variable "domain" {
  type        = string
  default     = "nrglabware.com"
  description = "Existing Cloudflare zone name."
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID."
  validation {
    condition     = can(regex("^[0-9a-f]{32}$", var.cloudflare_account_id))
    error_message = "cloudflare_account_id must be a 32-character lowercase hexadecimal ID."
  }
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Cloudflare production zone ID."
  validation {
    condition     = can(regex("^[0-9a-f]{32}$", var.cloudflare_zone_id))
    error_message = "cloudflare_zone_id must be a 32-character lowercase hexadecimal ID."
  }
}

variable "cloudflare_terraform_api_token" {
  type        = string
  sensitive   = true
  description = "Least-privilege Cloudflare token for Terraform."
}

variable "r2_admin_access_key_id" {
  type      = string
  sensitive = true
}

variable "r2_admin_secret_access_key" {
  type      = string
  sensitive = true
}

variable "neon_org_id" {
  type = string
}

variable "neon_api_key" {
  type      = string
  sensitive = true
}

variable "neon_owner_database_url" {
  type        = string
  sensitive   = true
  description = "Generated owner URL. Empty during phase one; grants run in phase two."
  default     = ""
}

variable "postgresql_host" {
  type        = string
  default     = "127.0.0.1"
  description = "Owner PostgreSQL hostname, populated from the generated Neon URL for grant runs."
}

variable "postgresql_port" {
  type    = number
  default = 5432
}

variable "postgresql_username" {
  type    = string
  default = "bootstrap"
}

variable "postgresql_password" {
  type      = string
  sensitive = true
  default   = ""
}

variable "azure_location" {
  type    = string
  default = "southeastasia"
}

variable "azure_subscription_id" {
  type = string
}

variable "azure_tenant_id" {
  type = string
}

variable "azure_budget_amount" {
  type        = number
  description = "Monthly budget in Azure billing currency."
  validation {
    condition     = var.azure_budget_amount > 0
    error_message = "azure_budget_amount must be greater than zero."
  }
}

variable "api_image" {
  type        = string
  description = "Immutable GHCR image digest."
  validation {
    condition     = can(regex("^ghcr\\.io/[^[:space:]]+@sha256:[a-f0-9]{64}$", var.api_image))
    error_message = "api_image must be an immutable GHCR sha256 digest reference."
  }
}

variable "origin_certificate_enabled" {
  type        = bool
  default     = true
  description = "Enable the phase-two Container Apps certificate binding."
}

variable "origin_certificate_name" {
  type    = string
  default = "api-origin-production-direct"
}

variable "origin_certificate_pfx_base64" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Base64-encoded PFX certificate for the Container Apps environment."
  validation {
    condition     = !var.origin_certificate_enabled || var.bootstrap_phase == "phase-1-base" || length(trimspace(var.origin_certificate_pfx_base64)) > 0
    error_message = "origin_certificate_pfx_base64 is required when the origin certificate is enabled."
  }
}

variable "origin_certificate_password" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Password for the origin certificate PFX."
  validation {
    condition     = !var.origin_certificate_enabled || var.bootstrap_phase == "phase-1-base" || length(var.origin_certificate_password) > 0
    error_message = "origin_certificate_password is required when the origin certificate is enabled."
  }
}

variable "trusted_proxy_cidrs" {
  type        = list(string)
  description = "Cloudflare proxy and Azure ingress CIDRs trusted by the API."
  default     = []
  validation {
    condition     = alltrue([for cidr in var.trusted_proxy_cidrs : can(cidrhost(cidr, 0))])
    error_message = "trusted_proxy_cidrs must contain valid IPv4 or IPv6 CIDR ranges."
  }
}

variable "runtime_secrets" {
  type      = map(string)
  sensitive = true
  default   = {}
  validation {
    condition = var.bootstrap_phase == "phase-1-base" || alltrue([
      for key in [
        "ACCESS_TOKEN_SECRET",
        "REFRESH_TOKEN_SECRET",
        "PENDING_TOKEN_SECRET",
        "DATA_ENCRYPTION_SECRET",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "OTEL_EXPORTER_OTLP_ENDPOINT",
        "OTEL_RESOURCE_ATTRIBUTES"
      ] : contains(nonsensitive(keys(var.runtime_secrets)), key)
    ])
    error_message = "Production API runtime secrets must include token, encryption, R2, and telemetry values."
  }
}

variable "enable_cloudflare_proxy" {
  type    = bool
  default = true
}

variable "backup_retention_days" {
  type    = number
  default = 35
}

variable "upload_retention_seconds" {
  type    = number
  default = 21600
}

variable "upload_cors_max_age_seconds" {
  type    = number
  default = 3600
}

variable "backup_object_lock_days" {
  type    = number
  default = 7
}
