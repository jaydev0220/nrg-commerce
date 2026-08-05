variable "cloudflare_zone_id" {
	type        = string
	description = "Cloudflare zone that contains the API hostname."
}

variable "api_domain" {
	type        = string
	description = "Public API hostname, without a scheme."
}

variable "container_app_hostname" {
	type        = string
	description = "Azure Container Apps generated ingress hostname."
}

variable "custom_domain_verification_id" {
	type        = string
	sensitive   = true
	description = "Azure Container Apps custom-domain verification value."
}

variable "environment" {
	type        = string
	description = "Deployment environment used for record comments."

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
