# GCP First-Time Setup

Do this once to provision all cloud infrastructure. After this, GitHub Actions handles all future deploys automatically.

## Prerequisites

```bash
# Install tools
brew install pulumi
brew install --cask google-cloud-sdk

# Authenticate with GCP
gcloud auth application-default login

# Install infra dependencies
cd infra && npm install
```

You also need:
- A GCP billing account ID — find it at https://console.cloud.google.com/billing
- A Pulumi account (free tier is fine) — https://app.pulumi.com

## Bootstrap

```bash
cd infra

# Log in to Pulumi (state is stored in Pulumi Cloud)
pulumi login

# Create the prod stack
pulumi stack init prod

# Set required config
pulumi config set billingAccount <YOUR_BILLING_ACCOUNT_ID>
pulumi config set region us-central1
pulumi config set githubRepo ikushlianski/bedtime-stories

# Optional: if you have a GCP org (Workspace account)
# pulumi config set orgId <YOUR_ORG_ID>
```

## Provision

```bash
pulumi up
```

This creates: GCP project, enables APIs, Artifact Registry, GCS bucket, Cloud Run service, service accounts, and Workload Identity Federation for GitHub Actions.

First run takes ~3 minutes. Review the preview and confirm with `yes`.

## After provisioning — add GitHub secrets

Grab the output values:

```bash
pulumi stack output projectId
pulumi stack output registryUrl
pulumi stack output ciSaEmail
pulumi stack output wifProviderName
pulumi stack output apiUrl
```

Go to https://github.com/ikushlianski/bedtime-stories/settings/secrets/actions and add:

| Secret name | Value |
|-------------|-------|
| `GCP_PROJECT_ID` | output of `projectId` |
| `GCP_REGION` | `us-central1` |
| `ARTIFACT_REGISTRY_URL` | output of `registryUrl` |
| `WIF_SA_EMAIL` | output of `ciSaEmail` |
| `WIF_PROVIDER` | output of `wifProviderName` |

Then add all runtime secrets (DATABASE_URL, JWT_SECRET, OPENROUTER_API_KEY, etc.) — see [README.md](./README.md) for the full list.

## Trigger first deploy

```bash
git push origin main
```

Watch the Actions tab. The first build takes ~5 minutes (installs deps, builds Vite, pushes Docker image).

## Update Cloud Run env vars after provisioning

The Cloud Run service is created with placeholder env vars. After adding GitHub secrets, push to main — the deploy workflow sets all env vars correctly via `gcloud run deploy --set-env-vars`.

## Tear down

```bash
cd infra && pulumi destroy
```

This deletes all GCP resources. The GCP project itself may need manual deletion from the console.

## Updating infrastructure

Edit `infra/index.ts`, then:

```bash
cd infra
pulumi preview   # see what will change
pulumi up        # apply changes
```
