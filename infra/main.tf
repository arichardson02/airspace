locals {
  # App Platform fills in ${db.*} values from the database component at deploy time.
  # In HCL, $${...} produces a literal ${...}.
  database_envs = {
    DATABASE_URL     = "$${db.DATABASE_URL}"
    DATABASE_CA_CERT = "$${db.CA_CERT}"
  }
}

resource "digitalocean_app" "fs_career" {
  spec {
    name   = var.app_name
    region = var.region

    # One domain: the frontend at /, the backend at /api with the prefix stripped,
    # so the backend still sees /v1/ingest and /health.
    ingress {
      rule {
        match {
          path {
            prefix = "/api"
          }
        }
        component {
          name                 = "backend"
          preserve_path_prefix = false
        }
      }

      rule {
        match {
          path {
            prefix = "/"
          }
        }
        component {
          name = "frontend"
        }
      }
    }

    service {
      name               = "backend"
      source_dir         = "/"
      dockerfile_path    = "backend/Dockerfile"
      http_port          = 3000
      instance_size_slug = var.instance_size
      instance_count     = 1

      github {
        repo           = var.github_repo
        branch         = var.branch
        deploy_on_push = true
      }

      health_check {
        http_path = "/health"
      }

      dynamic "env" {
        for_each = local.database_envs
        content {
          key   = env.key
          value = env.value
          scope = "RUN_TIME"
        }
      }
    }

    service {
      name               = "frontend"
      source_dir         = "/"
      dockerfile_path    = "frontend/Dockerfile"
      http_port          = 3000
      instance_size_slug = var.instance_size
      instance_count     = 1

      github {
        repo           = var.github_repo
        branch         = var.branch
        deploy_on_push = true
      }
    }

    # Applies database migrations before each new release goes live.
    job {
      name               = "migrate"
      kind               = "PRE_DEPLOY"
      source_dir         = "/"
      dockerfile_path    = "backend/Dockerfile"
      run_command        = "node dist/database/migrate.js"
      instance_size_slug = var.instance_size
      instance_count     = 1

      github {
        repo           = var.github_repo
        branch         = var.branch
        deploy_on_push = true
      }

      dynamic "env" {
        for_each = local.database_envs
        content {
          key   = env.key
          value = env.value
          scope = "RUN_TIME"
        }
      }
    }

    # Dev database ($7/month). For production, swap in a digitalocean_database_cluster
    # and reference it here with cluster_name and production = true.
    database {
      name       = "db"
      engine     = "PG"
      production = false
    }
  }
}

resource "digitalocean_project" "fs_career" {
  name        = var.app_name
  description = "Flight sim career app: frontend, backend and database."
  purpose     = "Web Application"
  environment = "Development"
  resources   = [digitalocean_app.fs_career.urn]
}
