/**
 * service-identity.ts — 서비스 정체성 canonical 타입.
 *
 * 로깅 SDK의 핵심 질문 "이 이벤트가 어디서 발생했는가"에 대한 단일 정답.
 *
 * ServiceBootConfig 하나로:
 *   - TransmissionSource.service_name 파생 (→ "namespace/name")
 *   - TransmissionBuild.env/build_ref 파생
 *   - 카탈로그 service prefix 차원 맵 파생 (→ { env, region, svc_name, namespace })
 *   - PartialBinder fixedDims 파생
 *
 * build/releaseVersion은 비좌표 메타데이터 — TransmissionBuild로만 전달.
 * 5Q 체크리스트 미통과: 유한하지 않음, 배포마다 변경됨.
 *
 * @note permission-engine의 ServiceIdentity/ServiceRef와 구조적으로 호환.
 *   TypeScript structural typing으로 ServiceBootConfig → ServiceRef 자동 할당 가능.
 */

import type { TransmissionSource, TransmissionBuild } from "./envelope.js";

// ── Types ────────────────────────────────────────────────────────────────────

/** 서비스 식별자 (필수 2필드). */
export interface ServiceIdentity {
  /** 서비스 네임스페이스. 예: "shop", "cms" */
  readonly namespace: string;
  /** 서비스 이름. 예: "payment", "auth", "gateway" */
  readonly name: string;
}

/** 배포 컨텍스트 — 좌표 차원 (required). */
export interface DeployContext {
  /** 환경. 카탈로그 env 축 매핑. 예: "dev", "stage", "prod" */
  readonly env: string;
  /** 리전. 카탈로그 region 축 매핑. 예: "asia", "usa" */
  readonly region: string;
}

/**
 * 서비스 부트 설정 — identity + deploy + 비좌표 메타데이터.
 *
 * 앱 초기화 시 한 번 생성하면 QaContext, ApmLogger, QaMonitor 모두에서 사용.
 */
export interface ServiceBootConfig extends ServiceIdentity, DeployContext {
  /** 빌드/버전 식별자. 비좌표 — TransmissionBuild.build_ref로만 전달. */
  readonly build?: string;
  /** 릴리즈 버전. 비좌표 — TransmissionBuild.release_version으로만 전달. */
  readonly releaseVersion?: string;
}

// ── Derivation Functions ─────────────────────────────────────────────────────

/**
 * ServiceBootConfig → 카탈로그 service prefix 차원 맵.
 *
 * 카탈로그의 service prefix는 4축: env, region, svc_name, namespace.
 * `name`을 `svc_name`으로 매핑한다 (카탈로그 축 레이블 컨벤션).
 */
export function toServiceDims(config: ServiceBootConfig): {
  env: string;
  region: string;
  svc_name: string;
  namespace: string;
} {
  return {
    env: config.env,
    region: config.region,
    svc_name: config.name,
    namespace: config.namespace,
  };
}

/**
 * ServiceBootConfig → TransmissionSource.
 *
 * service_name은 "namespace/name" 형식 (permission canonical form과 동일).
 */
export function toTransmissionSource(
  config: ServiceBootConfig,
  sdkName: string,
  sdkVersion: string,
): TransmissionSource {
  return {
    service_name: `${config.namespace}/${config.name}`,
    sdk_name: sdkName,
    sdk_version: sdkVersion,
  };
}

/**
 * ServiceBootConfig → TransmissionBuild.
 *
 * env는 catalogEnvToBuildEnv()로 정규화되어 전달.
 */
export function toTransmissionBuild(config: ServiceBootConfig): TransmissionBuild {
  return {
    env: catalogEnvToBuildEnv(config.env),
    ...(config.build != null ? { build_ref: config.build } : {}),
    ...(config.releaseVersion != null ? { release_version: config.releaseVersion } : {}),
  };
}

// ── Env Normalization ────────────────────────────────────────────────────────

const CATALOG_TO_BUILD: Record<string, string> = {
  prod: "production",
  stage: "staging",
};

const BUILD_TO_CATALOG: Record<string, string> = {
  production: "prod",
  staging: "stage",
};

/**
 * 카탈로그 env 축 값 → BuildEnv 정규화.
 *
 * "prod" → "production", "stage" → "staging". 나머지는 그대로 통과.
 */
export function catalogEnvToBuildEnv(catalogEnv: string): string {
  return CATALOG_TO_BUILD[catalogEnv] ?? catalogEnv;
}

/**
 * BuildEnv → 카탈로그 env 축 값 정규화.
 *
 * "production" → "prod", "staging" → "stage". 나머지는 그대로 통과.
 */
export function buildEnvToCatalogEnv(buildEnv: string): string {
  return BUILD_TO_CATALOG[buildEnv] ?? buildEnv;
}

// ── ServiceBootConfig from env ──────────────────────────────────────────────

/**
 * 환경변수에서 ServiceBootConfig를 생성한다.
 *
 * 인프라 서비스 공통 패턴. 환경변수:
 *   QA_SVC_NAMESPACE (기본: "shop")
 *   QA_SVC_NAME (필수 — 서비스 이름)
 *   QA_SVC_ENV (기본: "dev")
 *   QA_SVC_REGION (기본: "asia")
 *   QA_SVC_BUILD (선택)
 *   QA_SVC_RELEASE (선택)
 *
 * @param svcName — fallback 서비스 이름 (환경변수 미설정 시)
 * @param source — 환경변수 소스 (기본: process.env)
 */
export function createServiceBootConfig(
  svcName: string,
  source: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {},
): ServiceBootConfig {
  return {
    namespace: source.QA_SVC_NAMESPACE ?? "shop",
    name: source.QA_SVC_NAME ?? svcName,
    env: source.QA_SVC_ENV ?? "dev",
    region: source.QA_SVC_REGION ?? "asia",
    build: source.QA_SVC_BUILD,
    releaseVersion: source.QA_SVC_RELEASE,
  };
}
