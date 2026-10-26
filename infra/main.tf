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

    # Managed cluster rather than a dev database: dev databases can't create schemas, which
    # Drizzle's migrator needs for its history table.
    database {
      name         = "db"
      engine       = "PG"
      production   = true
      cluster_name = digitalocean_database_cluster.postgres.name
      db_name      = digitalocean_database_db.app.name
      db_user      = "doadmin"
    }
  }
}

resource "digitalocean_database_cluster" "postgres" {
  name       = "${var.app_name}-db"
  engine     = "pg"
  version    = "18"
  size       = var.database_size
  region     = var.database_region
  node_count = 1
}

resource "digitalocean_database_db" "app" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "fs_career"
}

# Only the app can connect to the database.
resource "digitalocean_database_firewall" "postgres" {
  cluster_id = digitalocean_database_cluster.postgres.id

  rule {
    type  = "app"
    value = digitalocean_app.fs_career.id
  }
}

resource "digitalocean_project" "fs_career" {
  name        = var.app_name
  description = "Flight sim career app: frontend, backend and database."
  purpose     = "Web Application"
  environment = "Development"
  resources = [
    digitalocean_app.fs_career.urn,
    digitalocean_database_cluster.postgres.urn,
  ]
}
