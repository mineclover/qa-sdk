export interface ServiceRecord {
  readonly serviceId: string;
  readonly name: string;
  readonly tier?: "frontend" | "backend" | "infra" | "system";
  readonly team?: string;
  /** 기본 URL (현재 환경) */
  readonly url?: string;
  /** 환경별 URL (dev/staging/prod) */
  readonly urls?: Readonly<Record<string, string>>;
  /** 게이트웨이 경로 prefix (예: "/v1/ingest") */
  readonly gatewayPath?: string;
  /** gateway에서 prefix를 제거 후 서비스에 전달 (기본 false — 경로 그대로 프록시) */
  readonly stripPrefix?: boolean;
  readonly ownedPrefixes: readonly string[];
  readonly consumedPrefixes?: readonly string[];
  /** 소속 Application ID */
  readonly applicationId?: string;
  /** 가변 속성 (App Hub Attributes) */
  readonly attributes?: ServiceAttributes;
}

/** 횡단 관심사 태그 — 보안, 성능, 관측성 등 */
export type ServiceConcernTag =
  | "security" | "performance" | "accessibility"
  | "observability" | "testing" | "migration" | "deprecation";

/** 계층 태그 — 서비스의 아키텍처 계층 */
export type ServiceTierTag =
  | "tier-frontend" | "tier-backend" | "tier-infra" | "tier-system";

/** 구조 태그 — 서비스의 구조적 특성 */
export type ServiceStructuralTag =
  | "cross-scope" | "entry-point" | "shared";

/** 가변 속성 — 사람이 부여하는 메타데이터 (App Hub Attributes 모델) */
export interface ServiceAttributes {
  readonly criticality?: "critical" | "high" | "medium" | "low";
  readonly owner?: {
    readonly developer?: string;
    readonly operator?: string;
    readonly business?: string;
  };
  readonly environment?: "production" | "staging" | "development" | "test";
  /** 횡단 관심사 (보안, 성능 등) — definition-catalog ConcernTag와 동일 */
  readonly concerns?: readonly ServiceConcernTag[];
  /** 아키텍처 계층 — 기존 tier 필드의 구조화된 버전 */
  readonly tierTag?: ServiceTierTag;
  /** 구조적 특성 */
  readonly structural?: readonly ServiceStructuralTag[];
}
