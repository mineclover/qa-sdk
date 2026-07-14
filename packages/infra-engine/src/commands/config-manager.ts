// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// commands/config-manager.ts — 인프라 설정 프로필 관리
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { isValidServiceUrl, isLocalhost } from '../lib/validation.js';

const CONFIG_DIR = resolve(homedir(), '.qa-sdk');
const CONFIG_FILE = resolve(CONFIG_DIR, 'infra-config.json');

/** 인프라 백엔드 프로필 */
export interface InfraConfig {
  /** Pulumi 상태 백엔드 */
  backend: 'file' | 'minio' | 's3';
  /** MinIO/S3 endpoint (backend=minio/s3 시) */
  s3Endpoint?: string;
  /** S3 버킷 이름 */
  s3Bucket: string;
  /** AWS 리전 */
  awsRegion: string;
  /** K8s 컨텍스트 */
  k8sContext: string;
  /** 서비스 연결 */
  services: {
    registry: string;
    ingest: string;
    definition: string;
  };
  /** Ingest 스토어 */
  ingestStore: 'memory' | 'd1' | 'pg';
  ingestSqlitePath?: string;
}

const PRESETS: Record<string, InfraConfig> = {
  local: {
    backend: 'file',
    s3Bucket: 'qa-sdk-infra-state',
    awsRegion: 'ap-northeast-2',
    k8sContext: 'k3d-qa-local',
    services: {
      registry: 'http://localhost:3300',
      ingest: 'http://localhost:3200',
      definition: 'http://localhost:3700',
    },
    ingestStore: 'd1',
    ingestSqlitePath: '~/.qa-sdk/ingest.sqlite',
  },
  'local-s3': {
    backend: 'minio',
    s3Endpoint: 'http://localhost:9000',
    s3Bucket: 'qa-sdk-infra-state',
    awsRegion: 'ap-northeast-2',
    k8sContext: 'k3d-qa-local',
    services: {
      registry: 'http://localhost:3300',
      ingest: 'http://localhost:3200',
      definition: 'http://localhost:3700',
    },
    ingestStore: 'd1',
    ingestSqlitePath: '~/.qa-sdk/ingest.sqlite',
  },
  staging: {
    backend: 's3',
    s3Bucket: 'qa-sdk-infra-state',
    awsRegion: 'ap-northeast-2',
    k8sContext: 'k3d-qa-local',
    services: {
      registry: 'https://registry.staging.qa-sdk.io',
      ingest: 'https://ingest.staging.qa-sdk.io',
      definition: 'http://localhost:3700',
    },
    ingestStore: 'd1',
    ingestSqlitePath: '~/.qa-sdk/ingest.sqlite',
  },
  prod: {
    backend: 's3',
    s3Bucket: 'qa-sdk-infra-state',
    awsRegion: 'ap-northeast-2',
    k8sContext: 'k3d-qa-local',
    services: {
      registry: 'https://registry.qa-sdk.io',
      ingest: 'https://ingest.qa-sdk.io',
      definition: 'https://definition.qa-sdk.io',
    },
    ingestStore: 'pg',
  },
};

export async function loadInfraConfig(): Promise<InfraConfig> {
  try {
    return JSON.parse(await readFile(CONFIG_FILE, 'utf-8'));
  } catch {
    return PRESETS['local-s3']; // 기본: MinIO S3 로컬
  }
}

export async function saveInfraConfig(config: InfraConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/** 프로필 전환 */
export async function switchProfile(name: string): Promise<InfraConfig> {
  const preset = PRESETS[name];
  if (!preset) {
    throw new Error(`알 수 없는 프로필: ${name}. 가능: ${Object.keys(PRESETS).join(', ')}`);
  }
  await saveInfraConfig(preset);
  return preset;
}

/** 개별 필드 설정 */
export async function setConfigField(field: string, value: string): Promise<InfraConfig> {
  const config = await loadInfraConfig();

  switch (field) {
    case 'backend': {
      if (!['file', 'minio', 's3'].includes(value)) throw new Error('backend: file | minio | s3');
      config.backend = value as InfraConfig['backend'];
      break;
    }
    case 'k8s-context':
      config.k8sContext = value;
      break;
    case 'registry':
      config.services.registry = value;
      break;
    case 'ingest':
      config.services.ingest = value;
      break;
    case 'definition':
      config.services.definition = value;
      break;
    case 'ingest-store': {
      if (!['memory', 'd1', 'pg'].includes(value))
        throw new Error('ingest-store: memory | d1 | pg');
      config.ingestStore = value as InfraConfig['ingestStore'];
      break;
    }
    case 's3-endpoint':
      config.s3Endpoint = value;
      break;
    case 's3-bucket':
      config.s3Bucket = value;
      break;
    default:
      throw new Error(`알 수 없는 필드: ${field}`);
  }

  await saveInfraConfig(config);
  return config;
}

export function resolvePulumiBackendUrl(config: InfraConfig): string | undefined {
  if (config.backend === 'minio' && config.s3Endpoint) {
    return `s3://${config.s3Bucket}?endpoint=${config.s3Endpoint}&disableSSL=true&s3ForcePathStyle=true`;
  }
  if (config.backend === 's3') {
    return `s3://${config.s3Bucket}`;
  }
  return undefined;
}

/** 설정을 환경변수로 적용 */
export async function applyConfigToEnv(config: InfraConfig): Promise<void> {
  const backendUrl = resolvePulumiBackendUrl(config);
  if (backendUrl) {
    process.env.PULUMI_BACKEND_URL ??= backendUrl;
  }

  // Pulumi backend credentials
  if (config.backend === 'minio' && config.s3Endpoint) {
    // MinIO 자격증명: secrets에서 로드, fallback은 기본값
    if (isLocalhost(config.s3Endpoint)) {
      try {
        const { loadSecrets } = await import('./secrets-manager.js');
        const secrets = await loadSecrets();
        process.env.AWS_ACCESS_KEY_ID ??= secrets?.minioRootUser ?? 'minioadmin';
        process.env.AWS_SECRET_ACCESS_KEY ??= secrets?.minioRootPassword ?? 'minioadmin';
      } catch {
        process.env.AWS_ACCESS_KEY_ID ??= 'minioadmin';
        process.env.AWS_SECRET_ACCESS_KEY ??= 'minioadmin';
      }
    }
  }
  // else "file" → PULUMI_BACKEND_URL 미설정 → file:// 기본

  process.env.AWS_DEFAULT_REGION ??= config.awsRegion;
  process.env.PULUMI_CONFIG_PASSPHRASE ??= '';

  // 서비스 URL — http/https만 허용
  if (isValidServiceUrl(config.services.registry)) {
    process.env.REGISTRY_URL ??= config.services.registry;
  }
  if (isValidServiceUrl(config.services.ingest)) {
    process.env.INGEST_URL ??= config.services.ingest;
  }
  if (isValidServiceUrl(config.services.definition)) {
    process.env.DEFINITION_URL ??= config.services.definition;
  }

  // K8s
  process.env.KUBECONFIG_CONTEXT ??= config.k8sContext;

  // Ingest store
  process.env.STORE_DRIVER ??= config.ingestStore;
  if (config.ingestSqlitePath) {
    process.env.SQLITE_PATH ??= config.ingestSqlitePath.replace('~', homedir());
  }
}

export function formatConfig(config: InfraConfig): string {
  const lines = [
    `  backend:      ${config.backend}${config.backend === 'minio' ? ` (${config.s3Endpoint})` : config.backend === 's3' ? ` (${config.s3Bucket})` : ''}`,
    `  k8s-context:  ${config.k8sContext}`,
    `  registry:     ${config.services.registry}`,
    `  ingest:       ${config.services.ingest}`,
    `  definition:   ${config.services.definition}`,
    `  ingest-store: ${config.ingestStore}${config.ingestSqlitePath ? ` (${config.ingestSqlitePath})` : ''}`,
  ];
  return lines.join('\n');
}

export function listPresets(): string[] {
  return Object.keys(PRESETS);
}

export function getPreset(name: string): InfraConfig | undefined {
  return PRESETS[name];
}
