output "app_url" {
  description = "Public URL of the app (frontend)."
  value       = digitalocean_app.fs_career.live_url
}

output "connector_backend_url" {
  description = "Value for the connector's BACKEND_URL."
  value       = "${digitalocean_app.fs_career.live_url}/api"
}

output "custom_domain_url" {
  description = "The app on its custom domain (once DNS and the certificate are in place)."
  value       = "https://${var.domain}"
}
