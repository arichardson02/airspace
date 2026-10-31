# Infrastructure

Terraform for deploying the app to DigitalOcean App Platform:

- `frontend` service (Next.js) at `/`
- `backend` service (NestJS) at `/api`
- `migrate` pre-deploy job (runs database migrations before each release)
- a managed Postgres cluster (`fs-career-db`, database `fs_career`), firewalled to the app; its connection details are passed to the backend and migrate job as secret env vars
- a DigitalOcean project grouping it all

Code deploys happen automatically on every push to the configured branch. Terraform is only
needed when the infrastructure itself changes (sizes, routes, env vars, database).

## One-time setup

1. Push this repository to GitHub.
2. In DigitalOcean, connect your GitHub account (Apps > Create App > GitHub) so App Platform
   can read the repo. You can cancel the wizard after authorizing.
3. Create a DigitalOcean API token with read/write access.
4. Create an HCP Terraform organization and a workspace for this app. Either:
   - set the workspace's execution mode to **Local**, so Terraform runs on your machine and
     only stores state in HCP; or
   - keep remote execution and add `DIGITALOCEAN_TOKEN` as a sensitive environment variable
     in the workspace.
5. Log in to HCP Terraform: `terraform login`.

## Each session

```sh
export DIGITALOCEAN_TOKEN=...         # PowerShell: $env:DIGITALOCEAN_TOKEN = "..."
export TF_CLOUD_ORGANIZATION=...
export TF_WORKSPACE=fs-career

cp terraform.tfvars.example terraform.tfvars   # first time only, then set github_repo
terraform init
terraform plan
terraform apply
```

After the first apply, `terraform output connector_backend_url` gives the value for the
connector's `BACKEND_URL`.

## Sign-in (Better Auth)

Accounts live in the app's own Postgres; the backend serves sign-in at `/api/auth`. It needs two
secrets in `terraform.tfvars`:

- `better_auth_secret`: generate with `openssl rand -base64 32`. Changing it signs everyone out.
- `resend_api_key`: from [Resend](https://resend.com). Add `airspace.club` as a domain there and
  create the DNS records it lists (SPF/DKIM) at Namecheap, so emails from
  `no-reply@airspace.club` are delivered.

The backend env is in `ignore_changes` (see the comment in `main.tf`), so new or changed backend
env vars only reach the app if you remove that block, apply, and put it back.

## Local checks without credentials

```sh
terraform init -backend=false
terraform validate
```
