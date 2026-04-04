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

/** 서비스 자체의 논리 단위 정의 */
export interface ServiceUnitSpec {
  readonly serviceId: string;
  readonly namespace: string;
  readonly name: string;
  readonly tier?: "frontend" | "backend" | "infra" | "system";
  readonly team?: string;
  readonly applicationId?: string;
  readonly attributes?: ServiceAttributes;
}

/** 서비스가 생산/소비하는 prefix 관계 */
export interface ServiceOwnershipSpec {
  readonly serviceId: string;
  readonly ownedPrefixes: readonly string[];
  readonly consumedPrefixes?: readonly string[];
}

/** 서비스의 gateway/routing 노출 정책 */
export interface ServiceExposureSpec {
  readonly serviceId: string;
  readonly gatewayPath?: string;
  readonly stripPrefix?: boolean;
}

/** qa-sdk 좌표계가 직접 인코딩하는 canonical runtime 주소 */
export interface RuntimeServiceAddress {
  readonly serviceId: string;
  readonly namespace: string;
  readonly name: string;
  readonly env: string;
  readonly region: string;
}

/** provider/project/stack/resourceKey까지 포함한 배포 주소 */
export interface DeploymentAddress {
  readonly serviceId: string;
  readonly runtime: RuntimeServiceAddress;
  readonly provider: string;
  readonly project: string;
  readonly stack: string;
  readonly resourceKey: string;
}

/** 배포 시스템이 관측한 URL/출력값 overlay */
export interface DeploymentBinding {
  readonly deploymentVersion: string;
  readonly address: DeploymentAddress;
  readonly observedAt: string;
  readonly urn?: string;
  readonly url?: string;
  readonly outputs?: Readonly<Record<string, unknown>>;
}

export type ComponentVersionKind =
  | "service-unit"
  | "ownership"
  | "exposure"
  | "runtime-address"
  | "deployment-binding";

/** child component의 독립 version 참조 */
export interface ComponentVersionRef {
  readonly kind: ComponentVersionKind;
  readonly serviceId: string;
  readonly version: string;
}

/** release artifact 참조 — 실제 manifest 본문은 별도 store가 관리 */
export interface ServiceReleaseManifestRef {
  readonly serviceId: string;
  readonly manifestVersion: string;
}

/** child component version을 조합해 manifest를 만들기 위한 입력 */
export interface ManifestAssemblyRequest {
  readonly serviceId: string;
  readonly runtimeAddressVersion: string;
  readonly serviceUnitVersion: string;
  readonly ownershipVersion: string;
  readonly exposureVersion?: string;
  readonly deploymentVersion?: string;
  readonly prefixes: Readonly<Record<string, string>>;
  readonly manifestVersion: string;
  readonly changelog?: string;
}

/** 서비스 주소 aggregate의 현재 분해 상태 */
export interface ServiceAddressAggregate {
  readonly serviceId: string;
  readonly unit: ServiceUnitSpec;
  readonly ownership: ServiceOwnershipSpec;
  readonly exposure?: ServiceExposureSpec;
  readonly runtimeAddresses: readonly RuntimeServiceAddress[];
  readonly deployments: readonly DeploymentBinding[];
  readonly releases?: readonly ServiceReleaseManifestRef[];
}
