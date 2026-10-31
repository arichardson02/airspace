variable "app_name" {
  description = "Name of the App Platform app and DigitalOcean project."
  type        = string
  default     = "fs-career"
}

variable "region" {
  description = "App Platform region slug, e.g. nyc, sfo, ams, fra."
  type        = string
  default     = "nyc"
}

variable "github_repo" {
  description = "GitHub repository to deploy, as owner/name."
  type        = string
}

variable "branch" {
  description = "Branch that is deployed on every push."
  type        = string
  default     = "main"
}

variable "instance_size" {
  description = "App Platform instance size for the frontend, backend and migrate job."
  type        = string
  default     = "apps-s-1vcpu-0.5gb"
}

variable "database_size" {
  description = "Managed Postgres node size."
  type        = string
  default     = "db-s-1vcpu-1gb"
}

variable "database_region" {
  description = "Managed Postgres datacenter slug; keep it near the app region."
  type        = string
  default     = "nyc3"
}

variable "domain" {
  description = "Custom domain for the app; www.<domain> is added as an alias."
  type        = string
  default     = "airspace.club"
}

variable "database_trusted_ips" {
  description = "Developer IP addresses allowed to connect to the database directly. Set in terraform.tfvars, not committed."
  type        = list(string)
  default     = []
}

variable "better_auth_secret" {
  description = "Secret Better Auth signs sessions and tokens with. Generate with: openssl rand -base64 32. Set in terraform.tfvars, not committed."
  type        = string
  sensitive   = true
}

variable "resend_api_key" {
  description = "Resend API key for verification and password reset emails. Set in terraform.tfvars, not committed."
  type        = string
  sensitive   = true
}
