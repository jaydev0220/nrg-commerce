terraform {
  required_version = ">= 1.10.0, < 2.0.0"

  cloud {}

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.81.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.22.0"
    }
  }
}

provider "azurerm" {
  features {}
}

provider "cloudflare" {}
