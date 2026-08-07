terraform {
  cloud {
    workspaces {
      name = "nrg-commerce-production"
    }
  }

  required_version = "= 1.15.5"

  required_providers {
    azapi = {
      source  = "azure/azapi"
      version = "~> 2.10"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.81"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.22"
    }
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.14"
    }
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "~> 1.26"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.azure_subscription_id
  tenant_id       = var.azure_tenant_id
}

provider "azapi" {}

provider "cloudflare" {
  api_token = var.cloudflare_terraform_api_token
}

provider "aws" {
  alias                       = "r2"
  region                      = "auto"
  access_key                  = var.r2_admin_access_key_id
  secret_key                  = var.r2_admin_secret_access_key
  skip_credentials_validation = true
  skip_requesting_account_id  = true
  skip_region_validation      = true
  skip_metadata_api_check     = true
  endpoints {
    s3 = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
  }
}

provider "neon" {
  api_key = var.neon_api_key
}

provider "postgresql" {
  alias           = "owner"
  connect_timeout = 15
  database        = "nrg_commerce"
  host            = var.postgresql_host
  password        = var.postgresql_password
  port            = var.postgresql_port
  sslmode         = "verify-full"
  username        = var.postgresql_username
}
