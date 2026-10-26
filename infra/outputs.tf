output "app_url" {
  description = "Public URL of the app (frontend)."
  value       = digitalocean_app.fs_career.live_url
}

output "connector_backend_url" {
  description = "Value for the connector's BACKEND_URL."
  value       = "${digitalocean_app.fs_career.live_url}/api"
}
