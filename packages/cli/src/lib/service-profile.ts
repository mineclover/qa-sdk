// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * service-profile — 서비스 URL 중앙 관리.
 *
 * ~/.qa-sdk/service-profile.json에 모드(local/staging/prod)별 서비스 URL 맵을 저장한다.
 * 모든 CLI 명령은 getServiceUrl(serviceId)로 URL을 조회한다.
 *
 * 우선순위: 환경변수 > 프로필 > 프리셋 기본값
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getQaSdkBaseHome } from './qa-dir.js';

// ── 타입 ────────────────────────────────────────────

export type ServiceMode = 'local' | 'staging' | 'prod';

export type InsightsDriver = 'local' | 'app-hub';

export interface AppHubConfig {
  endpoint: string;
  projectId: string;
  credential: string;
}

export interface ServiceProfile {
  mode: ServiceMode;
  insightsDriver: InsightsDriver;
  services: Record<string, string>;
  appHub?: AppHubConfig;
}

// ── 서비스 ID 상수 ──────────────────────────────────

export const SERVICE_IDS = [
  'ingest-server',
  'registry-service',
  'gate-service',
  'query-service',
  'decode-service',
  'definition-service',
  'motion-workspace',
  'decision-service',
] as const;

export type ServiceId = (typeof SERVICE_IDS)[number];

// ── 프리셋 ──────────────────────────────────────────

const LOCAL_SERVICES: Record<string, string> = {
  'ingest-server': 'http://localhost:3200',
  'registry-service': 'http://localhost:3300',
  'gate-service': 'http://localhost:3400',
  'query-service': 'http://localhost:3500',
  'decode-service': 'http://localhost:3600',
  'definition-service': 'http://localhost:3700',
  'motion-workspace': 'http://localhost:3710',
  'decision-service': 'http://localhost:3800',
};

const STAGING_SERVICES: Record<string, string> = {
  'ingest-server': 'https://ingest.staging.qa-sdk.io',
  'registry-service': 'https://registry.staging.qa-sdk.io',
  'gate-service': 'https://gate.staging.qa-sdk.io',
  'query-service': 'https://query.staging.qa-sdk.io',
  'decode-service': 'https://decode.staging.qa-sdk.io',
  'definition-service': 'https://definition.staging.qa-sdk.io',
  'motion-workspace': 'https://motion.staging.qa-sdk.io',
  'decision-service': 'https://decision.staging.qa-sdk.io',
};

const PROD_SERVICES: Record<string, string> = {
  'ingest-server': 'https://ingest.qa-sdk.io',
  'registry-service': 'https://registry.qa-sdk.io',
  'gate-service': 'https://gate.qa-sdk.io',
  'query-service': 'https://query.qa-sdk.io',
  'decode-service': 'https://decode.qa-sdk.io',
  'definition-service': 'https://definition.qa-sdk.io',
  'motion-workspace': 'https://motion.qa-sdk.io',
  'decision-service': 'https://decision.qa-sdk.io',
};

export const PROFILE_PRESETS: Record<ServiceMode, ServiceProfile> = {
  local: {
    mode: 'local',
    insightsDriver: 'local',
    services: LOCAL_SERVICES,
  },
  staging: {
    mode: 'staging',
    insightsDriver: 'local',
    services: STAGING_SERVICES,
  },
  prod: {
    mode: 'prod',
    insightsDriver: 'app-hub',
    services: PROD_SERVICES,
    appHub: { endpoint: 'https://apphub.googleapis.com/v1', projectId: '', credential: '' },
  },
};

// ── 환경변수 → 서비스 ID 맵핑 ──────────────────────

const ENV_VAR_MAP: Record<string, string> = {
  'ingest-server': 'INGEST_URL',
  'registry-service': 'QA_REGISTRY_URL',
  'gate-service': 'GATE_SERVICE_URL',
  'query-service': 'QUERY_SERVICE_URL',
  'decode-service': 'DECODE_SERVICE_URL',
  'definition-service': 'DEF_SERVICE_URL',
  'motion-workspace': 'MOTION_WORKSPACE_URL',
  'decision-service': 'DECISION_SERVICE_URL',
};

// ── 파일 I/O ────────────────────────────────────────

function getProfileDir(): string {
  return join(getQaSdkBaseHome(), '.qa-sdk');
}

function getProfileFilePath(): string {
  return join(getProfileDir(), 'service-profile.json');
}

function getLegacyProfilePath(): string {
  return join(getProfileDir(), 'ingest-profile.json');
}

export function getProfilePath(): string {
  return getProfileFilePath();
}

export function loadProfile(): ServiceProfile {
  const profilePath = getProfileFilePath();
  const legacyProfilePath = getLegacyProfilePath();
  try {
    if (existsSync(profilePath)) {
      return JSON.parse(readFileSync(profilePath, 'utf-8')) as ServiceProfile;
    }
    // 레거시 ingest-profile.json 마이그레이션
    if (existsSync(legacyProfilePath)) {
      const legacy = JSON.parse(readFileSync(legacyProfilePath, 'utf-8'));
      const migrated: ServiceProfile = {
        mode: legacy.mode ?? 'local',
        insightsDriver: legacy.insightsDriver ?? 'local',
        services: {
          ...LOCAL_SERVICES,
          ...(legacy.ingest ? { 'ingest-server': legacy.ingest } : {}),
          ...(legacy.registry ? { 'registry-service': legacy.registry } : {}),
        },
        appHub: legacy.appHub,
      };
      saveProfile(migrated);
      return migrated;
    }
  } catch {
    /* 파싱 실패 → 기본값 */
  }
  return PROFILE_PRESETS.local;
}

export function saveProfile(profile: ServiceProfile): void {
  const profileDir = getProfileDir();
  const profilePath = getProfileFilePath();
  if (!existsSync(profileDir)) mkdirSync(profileDir, { recursive: true });
  writeFileSync(profilePath, JSON.stringify(profile, null, 2) + '\n');
}

// ── 조회 API ────────────────────────────────────────

/**
 * 서비스 URL을 조회한다.
 *
 * 우선순위:
 * 1. 환경변수 (INGEST_URL, QA_REGISTRY_URL 등)
 * 2. --flag로 직접 지정된 URL (overrideUrl)
 * 3. service-profile.json
 * 4. local 프리셋 기본값
 */
export function getServiceUrl(serviceId: string, overrideUrl?: string): string {
  // 1. 환경변수
  const envKey = ENV_VAR_MAP[serviceId];
  if (envKey) {
    const envVal = process.env[envKey];
    if (envVal) return envVal;
  }

  // 2. 직접 지정
  if (overrideUrl) return overrideUrl;

  // 3. 프로필
  const profile = loadProfile();
  if (profile.services[serviceId]) return profile.services[serviceId];

  // 4. 기본값
  return LOCAL_SERVICES[serviceId] ?? `http://localhost:3200`;
}

/** 프로필의 현재 모드 반환 */
export function getCurrentMode(): ServiceMode {
  return loadProfile().mode;
}

/** 프로필의 insights 드라이버 반환 */
export function getInsightsDriver(): InsightsDriver {
  return loadProfile().insightsDriver;
}
