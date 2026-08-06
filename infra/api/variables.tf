variable "cloudflare_zone_id" {
  type        = string
  description = "Cloudflare zone that contains the API hostname."
}

variable "api_domain" {
  type        = string
  description = "Public API hostname, without a scheme."
}

variable "environment" {
  type        = string
  description = "Deployment environment used for resource names and record comments."

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "proxied" {
  type        = bool
  default     = true
  description = "Whether Cloudflare should proxy the API CNAME."
}

variable "azure_resource_group" {
  type        = string
  description = "Azure resource group for the API Container App."
}

variable "azure_location" {
  type        = string
  description = "Azure region for the API infrastructure."
}

variable "azure_container_app_environment" {
  type        = string
  description = "Azure Container Apps environment name."
}

variable "azure_container_app_name" {
  type        = string
  description = "Azure Container App name."
}

variable "bootstrap_image" {
  type        = string
  description = "Immutable image used only when Terraform initially creates the Container App. CI owns subsequent revisions."

  validation {
    condition     = can(regex("^ghcr\\.io/[^[:space:]]+@sha256:[a-f0-9]{64}$", var.bootstrap_image))
    error_message = "bootstrap_image must be an immutable GHCR sha256 digest reference."
  }
}

variable "origin_certificate_pfx_base64" {
  type        = string
  sensitive   = true
  description = "Base64-encoded Cloudflare Origin Certificate PFX."
}

variable "origin_certificate_password" {
  type        = string
  sensitive   = true
  description = "Password for the Cloudflare Origin Certificate PFX."
}
