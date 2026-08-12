import * as pulumi from '@pulumi/pulumi'
import * as gcp from '@pulumi/gcp'

const config = new pulumi.Config()
const region = config.get('region') ?? 'us-central1'
const billingAccount = config.require('billingAccount')

const project = new gcp.organizations.Project('bedtime-prod', {
  name: 'bedtime-prod',
  projectId: 'bedtime-prod',
  billingAccount,
})

const requiredApis = [
  'run.googleapis.com',
  'artifactregistry.googleapis.com',
  'storage.googleapis.com',
  'iam.googleapis.com',
  'cloudresourcemanager.googleapis.com',
  'iamcredentials.googleapis.com',
  'sts.googleapis.com',
  'compute.googleapis.com',
  'cloudscheduler.googleapis.com',
  'cloudtasks.googleapis.com',
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
    description: 'Docker images for bedtime-api',
  },
  { dependsOn: enabledApis },
)

const storageBucket = new gcp.storage.Bucket(
  'bedtime-prod-storage',
  {
    project: project.projectId,
    location: 'EUROPE-WEST3',
    name: 'bedtime-prod-storage',
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
    accountId: 'github-ci',
    displayName: 'GitHub Actions CI SA',
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
      `ci-${role.replace(/\//g, '-').replace(/\./g, '-')}`,
      {
        project: project.projectId,
        role,
        member: pulumi.interpolate`serviceAccount:${ciSa.email}`,
      },
    ),
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
            image: 'us-docker.pkg.dev/cloudrun/container/hello:latest',
            ports: [{ containerPort: 8080 }],
            envs: [
              { name: 'NODE_ENV', value: 'production' },
              { name: 'HOST', value: '0.0.0.0' },
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
  {
    dependsOn: [registry, apiSa, ...enabledApis],
    ignoreChanges: ['template'],
  },
)

new gcp.cloudrun.IamMember('api-public-invoker', {
  project: project.projectId,
  location: region,
  service: apiService.name,
  role: 'roles/run.invoker',
  member: 'allUsers',
})

const apiDomainMapping = new gcp.cloudrun.DomainMapping(
  'api-domain',
  {
    project: project.projectId,
    location: region,
    name: 'bedtime-agent.ilya.online',
    metadata: { namespace: project.projectId },
    spec: { routeName: apiService.name },
  },
  { dependsOn: [apiService] },
)

const pipelineQueueResource = new gcp.cloudtasks.Queue(
  'bedtime-pipeline',
  {
    project: project.projectId,
    location: region,
    name: 'bedtime-pipeline',
    rateLimits: {
      maxConcurrentDispatches: 3,
      maxDispatchesPerSecond: 1,
    },
    retryConfig: {
      maxAttempts: 5,
      minBackoff: '30s',
      maxBackoff: '600s',
      maxDoublings: 3,
    },
  },
  { dependsOn: enabledApis },
)

new gcp.projects.IAMMember('api-cloudtasks-enqueuer', {
  project: project.projectId,
  role: 'roles/cloudtasks.enqueuer',
  member: pulumi.interpolate`serviceAccount:${apiSa.email}`,
})

const catalogSyncSecret = config.requireSecret('catalogSyncSecret')

new gcp.cloudscheduler.Job(
  'catalog-sync',
  {
    project: project.projectId,
    region,
    name: 'catalog-sync',
    description: 'Daily OpenRouter model catalog sync',
    schedule: '0 3 * * *',
    timeZone: 'UTC',
    attemptDeadline: '300s',
    retryConfig: {
      retryCount: 3,
      maxRetryDuration: '3600s',
      minBackoffDuration: '60s',
      maxBackoffDuration: '600s',
      maxDoublings: 3,
    },
    httpTarget: {
      uri: 'https://bedtime-agent.ilya.online/api/internal/catalog-sync',
      httpMethod: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Catalog-Sync-Secret': catalogSyncSecret,
      },
      body: Buffer.from('{}').toString('base64'),
    },
  },
  { dependsOn: enabledApis },
)

const universeMemorySyncSecret = config.requireSecret('universeMemorySyncSecret')

new gcp.cloudscheduler.Job(
  'universe-memory-sync',
  {
    project: project.projectId,
    region,
    name: 'universe-memory-sync',
    description: 'Nightly universe memory (style guide) sync from accumulated feedback',
    schedule: '0 4 * * *',
    timeZone: 'UTC',
    attemptDeadline: '300s',
    retryConfig: {
      retryCount: 3,
      maxRetryDuration: '3600s',
      minBackoffDuration: '60s',
      maxBackoffDuration: '600s',
      maxDoublings: 3,
    },
    httpTarget: {
      uri: 'https://bedtime-agent.ilya.online/api/internal/universe-memory-sync',
      httpMethod: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Universe-Memory-Sync-Secret': universeMemorySyncSecret,
      },
      body: Buffer.from('{}').toString('base64'),
    },
  },
  { dependsOn: enabledApis },
)

const dailySuggestionsSecret = config.requireSecret('dailySuggestionsSecret')

new gcp.cloudscheduler.Job(
  'daily-suggestions',
  {
    project: project.projectId,
    region,
    name: 'daily-suggestions',
    description: 'Daily AI suggestions for pending topics and story ideas',
    schedule: '0 5 * * *',
    timeZone: 'UTC',
    attemptDeadline: '300s',
    retryConfig: {
      retryCount: 3,
      maxRetryDuration: '3600s',
      minBackoffDuration: '60s',
      maxBackoffDuration: '600s',
      maxDoublings: 3,
    },
    httpTarget: {
      uri: 'https://bedtime-agent.ilya.online/api/internal/daily-suggestions',
      httpMethod: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Daily-Suggestions-Secret': dailySuggestionsSecret,
      },
      body: Buffer.from('{}').toString('base64'),
    },
  },
  { dependsOn: enabledApis },
)

export const projectId = project.projectId
export const apiUrl = apiService.statuses[0].url
export const registryUrl = pulumi.interpolate`${region}-docker.pkg.dev/${project.projectId}/${registry.repositoryId}`
export const ciSaEmail = ciSa.email
export const bucketName = storageBucket.name
export const domainMappingRecords = apiDomainMapping.statuses
export const pipelineQueue = pipelineQueueResource.id
