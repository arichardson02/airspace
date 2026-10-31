data "digitalocean_database_ca" "postgres" {
  cluster_id = digitalocean_database_cluster.postgres.id
}

locals {
  # Connection details come straight from the cluster rather than an App Platform database
  # component, whose ${db.*} bindings kept resolving to the app's old dev database.
  database_envs = {
    DATABASE_URL = format(
      "postgresql://%s:%s@%s:%d/%s?sslmode=require",
      digitalocean_database_cluster.postgres.user,
      urlencode(digitalocean_database_cluster.postgres.password),
      digitalocean_database_cluster.postgres.host,
      digitalocean_database_cluster.postgres.port,
      digitalocean_database_db.app.name,
    )
    DATABASE_CA_CERT = data.digitalocean_database_ca.postgres.certificate
  }

  backend_secret_envs = merge(local.database_envs, {
    BETTER_AUTH_SECRET = var.better_auth_secret
    RESEND_API_KEY     = var.resend_api_key
  })
}

resource "digitalocean_app" "fs_career" {
  spec {
    name   = var.app_name
    region = var.region

    # DNS is hosted at Namecheap: @ is an ALIAS and www a CNAME to the app's default
    # ondigitalocean.app hostname. App Platform issues the certificates.
    domain {
      name = var.domain
      type = "PRIMARY"
    }

    domain {
      name = "www.${var.domain}"
      type = "ALIAS"
    }

    # One domain: the frontend at /, the backend at /api. The backend serves everything under
    # /api itself, because Better Auth matches its routes on the full path (/api/auth/*).
    ingress {
      rule {
        match {
          path {
            prefix = "/api"
          }
        }
        component {
          name                 = "backend"
          preserve_path_prefix = true
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
        http_path = "/api/health"
      }

      dynamic "env" {
        for_each = local.backend_secret_envs
        content {
          key   = env.key
          value = env.value
          scope = "RUN_TIME"
          type  = "SECRET"
        }
      }

      # The public origin sign-in links and cookies are issued for.
      env {
        key   = "BETTER_AUTH_URL"
        value = "https://${var.domain}"
        scope = "RUN_TIME"
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

      # Server-rendered pages check the session with the backend through the public URL.
      env {
        key   = "BACKEND_URL"
        value = "https://${var.domain}"
        scope = "RUN_TIME"
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
          type  = "SECRET"
        }
      }
    }
  }

  lifecycle {
    # DigitalOcean only returns SECRET env values encrypted (EV[...]), so Terraform would see a
    # change on every plan. If the database password, cluster, auth secret or Resend key changes
    # (or a backend env var is added), remove this, apply, and put it back.
    ignore_changes = [
      spec[0].service[0].env, # backend
      spec[0].job[0].env,     # migrate
    ]
  }
}

# Managed cluster rather than an App Platform dev database: dev databases can't create
# schemas, which Drizzle's migrator needs for its history table.
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

# Only the app, plus any developer IPs in var.database_trusted_ips, can connect to the database.
resource "digitalocean_database_firewall" "postgres" {
  cluster_id = digitalocean_database_cluster.postgres.id

  rule {
    type  = "app"
    value = digitalocean_app.fs_career.id
  }

  dynamic "rule" {
    for_each = toset(var.database_trusted_ips)
    content {
      type  = "ip_addr"
      value = rule.value
    }
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
