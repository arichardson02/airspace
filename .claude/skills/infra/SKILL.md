---
name: infra
description: Airspace's infrastructure and deploys — DigitalOcean App Platform and managed Postgres via Terraform in infra/ with HCP Terraform state, the airspace.club domain and Namecheap DNS, push-to-main deploys, the migrate pre-deploy job, and the ignore_changes step for backend env. Use when deploying, changing production config or secrets, running Terraform, or debugging production.
---

# Infrastructure and deploys

DigitalOcean App Platform, managed by Terraform in `infra/` with state in HCP Terraform (organization
`fs-careers`, workspace `fs-career`).

- One domain, `airspace.club` (DNS at Namecheap: `@` ALIAS and `www` CNAME to the app's ondigitalocean.app
  host). The frontend serves `/`, and the backend serves `/api` with the prefix kept.
- Components: `backend` and `frontend` services (both built from the repo root with their Dockerfiles), a
  `migrate` pre-deploy job, a managed Postgres cluster (`fs-career-db`, database `fs_career`) firewalled to the
  app, and a DigitalOcean project grouping them.
- **Code deploys on every push to `main`.** Terraform is only for infrastructure changes.
- Running Terraform: export `DIGITALOCEAN_TOKEN`, `TF_CLOUD_ORGANIZATION=fs-careers` and
  `TF_WORKSPACE=fs-career`, then `terraform init`, `plan` and `apply` in `infra/`. Settings and secrets
  (`github_repo`, `better_auth_secret`, `resend_api_key`, `database_trusted_ips`) go in the uncommitted
  `infra/terraform.tfvars` (copy `terraform.tfvars.example`). `terraform init -backend=false && terraform
validate` checks the config without credentials.
- **Backend env changes need an extra step.** DigitalOcean only returns SECRET env values encrypted, so the
  backend and migrate env are in `ignore_changes`. To change them, remove that block, apply, and put it back.
- First-time setup: connect GitHub to DigitalOcean (Apps → Create App → GitHub), create a DigitalOcean API token,
  create the HCP organization and workspace (local execution, or remote with `DIGITALOCEAN_TOKEN` set there),
  then `terraform login`.
