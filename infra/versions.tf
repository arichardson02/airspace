terraform {
  required_version = ">= 1.6"

  # Shared state in HCP Terraform. The organization and workspace come from the
  # TF_CLOUD_ORGANIZATION and TF_WORKSPACE environment variables (see README.md).
  cloud {}

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

# Authenticates with the DIGITALOCEAN_TOKEN environment variable.
provider "digitalocean" {}
