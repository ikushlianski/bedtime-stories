# GCP First-Time Setup

This is a one-time process. After it is done, all future infrastructure changes go through Pulumi (via GitHub Actions or locally), and all deploys go through GitHub Actions automatically.

## Prerequisites

```bash
brew install pulumi
brew install --cask google-cloud-sdk

# Authenticate as yourself
gcloud auth login
gcloud auth application-default login
```

You also need:
- A GCP billing account ID — https://console.cloud.google.com/billing
- `roles/owner` on the billing account (to link it to the new project)
- A GCP "bootstrap" project that already exists and has billing enabled — Pulumi uses this project's credentials to create `bedtime-prod`

## Step 1: Create the Pulumi state bucket

Pulumi state is stored in GCS, not Pulumi Cloud. This bucket must exist before any `pulumi up` runs.

```bash
# Create the bucket in the bootstrap project (it lives there, not in bedtime-prod)
gsutil mb -p <BOOTSTRAP_PROJECT_ID> -l europe-west3 gs://bedtime-pulumi-state
gsutil versioning set on gs://bedtime-pulumi-state
```

## Step 2: Enable Service Usage API on the target project

Pulumi needs `serviceusage.googleapis.com` to list and enable other APIs. This must be enabled before the first `pulumi up`.

```bash
# First create the project if it doesn't exist yet, or skip if already exists
gcloud projects create bedtime-prod --name="bedtime-prod"
gcloud billing projects link bedtime-prod --billing-account=<BILLING_ACCOUNT_ID>

# Enable Service Usage so Pulumi can manage other APIs
gcloud services enable serviceusage.googleapis.com --project=bedtime-prod
```

## Step 3: Set up Workload Identity Federation

This allows GitHub Actions to authenticate to GCP without a service account JSON key.

```bash
# Create the WIF pool
gcloud iam workload-identity-pools create github \
  --project=bedtime-prod \
  --location=global \
  --display-name="GitHub Actions"

# Create the OIDC provider
gcloud iam workload-identity-pools providers create-oidc github-actions \
  --project=bedtime-prod \
  --location=global \
  --workload-identity-pool=github \
  --display-name="GitHub Actions provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Get the provider resource name (you'll need this in deploy.yml)
gcloud iam workload-identity-pools providers describe github-actions \
  --project=bedtime-prod \
  --location=global \
  --workload-identity-pool=github \
  --format="value(name)"
```

The provider resource name looks like:
`projects/28324530789/locations/global/workloadIdentityPools/github/providers/github-actions`

This value is hardcoded in `.github/workflows/deploy.yml`. If you recreate the provider, update the workflow file.

## Step 4: Create the github-ci service account and bind WIF

Pulumi creates the `github-ci` SA, but WIF binding must be set up after the SA exists.

If running the bootstrap from scratch:

```bash
# Create the SA (Pulumi will also try to create it — skip if already exists)
gcloud iam service-accounts create github-ci \
  --project=bedtime-prod \
  --display-name="GitHub Actions CI SA"

# Bind WIF: allow the GitHub repo to impersonate this SA
PROJECT_NUMBER=$(gcloud projects describe bedtime-prod --format="value(projectNumber)")
gcloud iam service-accounts add-iam-policy-binding \
  github-ci@bedtime-prod.iam.gserviceaccount.com \
  --project=bedtime-prod \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/ikushlianski/bedtime-stories"
```

## Step 5: Grant the CI SA owner rights

Pulumi needs broad permissions to create and manage IAM policies, enable APIs, and provision all resources.

```bash
gcloud projects add-iam-policy-binding bedtime-prod \
  --member="serviceAccount:github-ci@bedtime-prod.iam.gserviceaccount.com" \
  --role="roles/owner"
```

## Step 6: Initialize the Pulumi stack

```bash
cd infra
npm install

# Point Pulumi at the GCS backend
export PULUMI_BACKEND_URL=gs://bedtime-pulumi-state

# Init the stack (choose a passphrase — save it as GitHub secret PROD_PULUMI_CONFIG_PASSPHRASE)
pulumi stack init prod

# Set config
pulumi config set billingAccount <BILLING_ACCOUNT_ID> --secret
pulumi config set region europe-west3
pulumi config set githubRepo ikushlianski/bedtime-stories
pulumi config set gcp:project <BOOTSTRAP_PROJECT_ID>
```

## Step 7: First pulumi up

```bash
cd infra
PULUMI_BACKEND_URL=gs://bedtime-pulumi-state \
  PULUMI_CONFIG_PASSPHRASE="<passphrase>" \
  pulumi up --stack prod
```

This creates all GCP resources: APIs, Artifact Registry, GCS bucket, service accounts, IAM bindings, Cloud Run service.

After it succeeds, check the outputs:

```bash
pulumi stack output --stack prod
```

Expected outputs: `projectId`, `registryUrl`, `ciSaEmail`, `apiUrl`, `bucketName`.

## Step 8: Configure GitHub Actions

Go to `https://github.com/ikushlianski/bedtime-stories/settings/environments` and create a `prod` environment.

Add these **variables**:

| Variable | Value (from pulumi output or known) |
|----------|-------------------------------------|
| `PROD_REGION` | `europe-west3` |
| `PROD_PROJECT_ID` | `bedtime-prod` |
| `PROD_REGISTRY` | output of `pulumi stack output registryUrl` + `/api` |
| `PROD_SENTRY_ORG` | your Sentry org slug |
| `PROD_SENTRY_PROJECT` | your Sentry project slug |
| `PROD_LANGFUSE_BASE_URL` | `https://cloud.langfuse.com` |

Add these **secrets**:

| Secret | Description |
|--------|-------------|
| `PROD_PULUMI_CONFIG_PASSPHRASE` | The passphrase chosen in Step 6 |
| `PROD_DATABASE_URL` | Neon PostgreSQL connection string |
| `PROD_JWT_SECRET` | Min 32-char random string |
| `PROD_OPENROUTER_API_KEY` | OpenRouter API key |
| `PROD_SENTRY_DSN` | Sentry DSN |
| `PROD_VITE_SENTRY_DSN` | Same Sentry DSN (embedded in frontend bundle) |
| `PROD_SENTRY_AUTH_TOKEN` | Sentry auth token for source map upload |
| `PROD_LANGFUSE_SECRET_KEY` | Langfuse secret key |
| `PROD_LANGFUSE_PUBLIC_KEY` | Langfuse public key |

## Step 9: Push to main

```bash
git push origin main
```

The GitHub Actions pipeline runs: test → infra (pulumi up) → deploy (docker build + cloud run).

The first build takes ~5 minutes. Watch progress at:
`https://github.com/ikushlianski/bedtime-stories/actions`

After the first successful deploy, the Cloud Run URL is available in the GCP Console and via:
```bash
PULUMI_BACKEND_URL=gs://bedtime-pulumi-state \
  PULUMI_CONFIG_PASSPHRASE="<passphrase>" \
  pulumi stack output apiUrl --stack prod
```

## Step 10: Point bedtime-agent.ilya.online to the load balancer (one-time)

Pulumi creates a reserved global static IP for the HTTPS load balancer. After the first `pulumi up` succeeds, get the IP:

```bash
cd infra
PULUMI_BACKEND_URL=gs://bedtime-pulumi-state \
  PULUMI_CONFIG_PASSPHRASE="<passphrase>" \
  pulumi stack output lbIp --stack prod
```

Then create an A record in Route53 for `bedtime-agent.ilya.online` pointing to that IP (TTL 300). The GCP-managed SSL certificate for the domain provisions automatically once DNS resolves — allow 15–60 minutes.

This is a one-time step. The static IP is reserved and never changes unless the Pulumi stack is destroyed.

---

## Tear down

```bash
cd infra
PULUMI_BACKEND_URL=gs://bedtime-pulumi-state \
  PULUMI_CONFIG_PASSPHRASE="<passphrase>" \
  pulumi destroy --stack prod
```

This deletes all Pulumi-managed resources. The GCS state bucket and WIF setup must be deleted manually. The GCP project itself requires manual deletion from the console.
