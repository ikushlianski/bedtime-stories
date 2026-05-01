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

// Global HTTPS Load Balancer for bedtime-agent.ilya.online
// (Cloud Run domain mappings are not available in europe-west3)

const lbStaticIp = new gcp.compute.GlobalAddress(
  'api-lb-ip',
  {
    project: project.projectId,
    name: 'bedtime-api-lb-ip',
  },
  { dependsOn: enabledApis },
)

const neg = new gcp.compute.RegionNetworkEndpointGroup(
  'api-neg',
  {
    project: project.projectId,
    name: 'bedtime-api-neg',
    region: region,
    networkEndpointType: 'SERVERLESS',
    cloudRun: { service: apiService.name },
  },
  { dependsOn: [apiService] },
)

const backendService = new gcp.compute.BackendService(
  'api-backend',
  {
    project: project.projectId,
    name: 'bedtime-api-backend',
    protocol: 'HTTPS',
    backends: [{ group: neg.id }],
    loadBalancingScheme: 'EXTERNAL_MANAGED',
  },
  { dependsOn: [neg] },
)

const urlMap = new gcp.compute.URLMap(
  'api-url-map',
  {
    project: project.projectId,
    name: 'bedtime-api-url-map',
    defaultService: backendService.id,
  },
  { dependsOn: [backendService] },
)

const sslCert = new gcp.compute.ManagedSslCertificate(
  'api-ssl-cert',
  {
    project: project.projectId,
    name: 'bedtime-api-ssl-cert',
    managed: { domains: ['bedtime-agent.ilya.online'] },
  },
  { dependsOn: enabledApis },
)

const httpsProxy = new gcp.compute.TargetHttpsProxy(
  'api-https-proxy',
  {
    project: project.projectId,
    name: 'bedtime-api-https-proxy',
    urlMap: urlMap.id,
    sslCertificates: [sslCert.id],
  },
  { dependsOn: [urlMap, sslCert], ignoreChanges: ['sslCertificates'] },
)

new gcp.compute.GlobalForwardingRule(
  'api-https-fw',
  {
    project: project.projectId,
    name: 'bedtime-api-https-fw',
    target: httpsProxy.id,
    ipAddress: lbStaticIp.address,
    portRange: '443',
    loadBalancingScheme: 'EXTERNAL_MANAGED',
  },
  { dependsOn: [httpsProxy, lbStaticIp] },
)

const httpRedirectUrlMap = new gcp.compute.URLMap(
  'api-http-redirect',
  {
    project: project.projectId,
    name: 'bedtime-api-http-redirect',
    defaultUrlRedirect: {
      httpsRedirect: true,
      redirectResponseCode: 'MOVED_PERMANENTLY_DEFAULT',
      stripQuery: false,
    },
  },
  { dependsOn: enabledApis },
)

const httpProxy = new gcp.compute.TargetHttpProxy(
  'api-http-proxy',
  {
    project: project.projectId,
    name: 'bedtime-api-http-proxy',
    urlMap: httpRedirectUrlMap.id,
  },
  { dependsOn: [httpRedirectUrlMap] },
)

new gcp.compute.GlobalForwardingRule(
  'api-http-fw',
  {
    project: project.projectId,
    name: 'bedtime-api-http-fw',
    target: httpProxy.id,
    ipAddress: lbStaticIp.address,
    portRange: '80',
    loadBalancingScheme: 'EXTERNAL_MANAGED',
  },
  { dependsOn: [httpProxy, lbStaticIp] },
)

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

export const projectId = project.projectId
export const apiUrl = apiService.statuses[0].url
export const registryUrl = pulumi.interpolate`${region}-docker.pkg.dev/${project.projectId}/${registry.repositoryId}`
export const ciSaEmail = ciSa.email
export const bucketName = storageBucket.name
export const lbIp = lbStaticIp.address
