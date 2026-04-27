import * as pulumi from '@pulumi/pulumi'
import * as gcp from '@pulumi/gcp'

const config = new pulumi.Config()
const region = config.get('region') ?? 'us-central1'
const githubRepo = config.get('githubRepo') ?? 'ikushlianski/bedtime-stories'
const billingAccount = config.require('billingAccount')
const orgId = config.get('orgId')

const project = new gcp.organizations.Project('bedtime-agent', {
  name: 'bedtime-agent',
  projectId: `bedtime-agent-${pulumi.getStack()}`,
  billingAccount,
  ...(orgId ? { orgId } : {}),
})

const requiredApis = [
  'run.googleapis.com',
  'artifactregistry.googleapis.com',
  'storage.googleapis.com',
  'secretmanager.googleapis.com',
  'iam.googleapis.com',
  'cloudresourcemanager.googleapis.com',
  'iamcredentials.googleapis.com',
  'sts.googleapis.com',
]

const enabledApis = requiredApis.map(
  (service) =>
    new gcp.projects.Service(
      service.replace(/\./g, '-'),
      { project: project.projectId, service },
      { dependsOn: [project] },
    ),
)

const registry = new gcp.artifactregistry.Repository(
  'api-images',
  {
    project: project.projectId,
    location: region,
    repositoryId: 'bedtime-api',
    format: 'DOCKER',
    description: 'Docker images for bedtime-agent API',
  },
  { dependsOn: enabledApis },
)

const storageBucket = new gcp.storage.Bucket(
  'bedtime-storage',
  {
    project: project.projectId,
    location: 'US',
    name: pulumi.interpolate`bedtime-storage-${project.projectId}`,
    uniformBucketLevelAccess: true,
    versioning: { enabled: true },
  },
  { dependsOn: enabledApis },
)

const apiSa = new gcp.serviceaccount.Account(
  'api-sa',
  {
    project: project.projectId,
    accountId: 'bedtime-api',
    displayName: 'Bedtime API Cloud Run SA',
  },
  { dependsOn: enabledApis },
)

const ciSa = new gcp.serviceaccount.Account(
  'ci-sa',
  {
    project: project.projectId,
    accountId: 'github-actions',
    displayName: 'GitHub Actions CI/CD SA',
  },
  { dependsOn: enabledApis },
)

const ciRoles = [
  'roles/run.admin',
  'roles/artifactregistry.writer',
  'roles/storage.admin',
  'roles/iam.serviceAccountUser',
]

ciRoles.forEach(
  (role) =>
    new gcp.projects.IAMMember(
      `ci-sa-${role.replace(/\//g, '-').replace(/\./g, '-')}`,
      {
        project: project.projectId,
        role,
        member: pulumi.interpolate`serviceAccount:${ciSa.email}`,
      },
    ),
)

const wifPool = new gcp.iam.WorkloadIdentityPool(
  'github-pool',
  {
    project: project.projectId,
    workloadIdentityPoolId: 'github-actions',
    displayName: 'GitHub Actions Pool',
  },
  { dependsOn: enabledApis },
)

const wifProvider = new gcp.iam.WorkloadIdentityPoolProvider(
  'github-provider',
  {
    project: project.projectId,
    workloadIdentityPoolId: wifPool.workloadIdentityPoolId,
    workloadIdentityPoolProviderId: 'github',
    displayName: 'GitHub OIDC',
    oidc: { issuerUri: 'https://token.actions.githubusercontent.com' },
    attributeMapping: {
      'google.subject': 'assertion.sub',
      'attribute.repository': 'assertion.repository',
      'attribute.actor': 'assertion.actor',
    },
    attributeCondition: `attribute.repository == "${githubRepo}"`,
  },
  { dependsOn: [wifPool] },
)

new gcp.serviceaccount.IAMMember(
  'wif-ci-sa-binding',
  {
    serviceAccountId: ciSa.name,
    role: 'roles/iam.workloadIdentityUser',
    member: pulumi.interpolate`principalSet://iam.googleapis.com/${wifPool.name}/attribute.repository/${githubRepo}`,
  },
  { dependsOn: [wifPool, wifProvider, ciSa] },
)

const apiService = new gcp.cloudrun.Service(
  'api',
  {
    project: project.projectId,
    location: region,
    name: 'bedtime-api',
    template: {
      spec: {
        serviceAccountName: apiSa.email,
        containers: [
          {
            image: pulumi.interpolate`${region}-docker.pkg.dev/${project.projectId}/${registry.repositoryId}/api:latest`,
            ports: [{ containerPort: 8080 }],
            envs: [
              { name: 'NODE_ENV', value: 'production' },
              { name: 'HOST', value: '0.0.0.0' },
              { name: 'PORT', value: '8080' },
            ],
            resources: {
              limits: { memory: '512Mi', cpu: '1' },
            },
          },
        ],
      },
      metadata: {
        annotations: {
          'autoscaling.knative.dev/maxScale': '3',
        },
      },
    },
  },
  { dependsOn: [registry, apiSa, ...enabledApis] },
)

new gcp.cloudrun.IamMember('api-public-invoker', {
  project: project.projectId,
  location: region,
  service: apiService.name,
  role: 'roles/run.invoker',
  member: 'allUsers',
})

export const projectId = project.projectId
export const apiUrl = apiService.statuses[0].url
export const registryUrl = pulumi.interpolate`${region}-docker.pkg.dev/${project.projectId}/${registry.repositoryId}`
export const ciSaEmail = ciSa.email
export const wifProviderName = wifProvider.name
export const bucketName = storageBucket.name
