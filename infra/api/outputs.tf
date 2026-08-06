output "api_domain" {
  value = var.api_domain
}

output "container_app_hostname" {
  value = azurerm_container_app.api.ingress[0].fqdn
}

output "container_app_id" {
  value = azurerm_container_app.api.id
}

output "container_app_environment_id" {
  value = azurerm_container_app_environment.api.id
}

output "origin_certificate_id" {
  value = azurerm_container_app_environment_certificate.api_origin.id
}
