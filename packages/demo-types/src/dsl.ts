// Generated from Catalog "demo" (hash: cc012d402486) by codegen-core@0.1.0
// catalogDigest: sha256:cc012d402486255e232f4dc53651d0299cf66098a91e0f1c0ed986e4797c2789 · sourceDigest: sha256:4fe36cb1b82c6248c9f2fc7d564b0d06d008cf2ed00bc6610fd5649a1e6cd545
// !! 자동 생성 파일 — 직접 수정 금지 !!

/** 관측 DSL — 화면/API/흐름 관측 포인트 + 패턴 분류를 서비스 단위로 묶는 DSL. 모든 관측 prefix가 동일한 svc_ref를 공유한다. */
export const DSL_OBSERVATION = {
  id: 'dsl-observation' as const,
  members: [
    'page_view',
    'endpoint',
    'flow_point',
    'pattern_match',
    'pattern_anomaly',
    'event_classification',
    'resource_lifecycle',
  ] as const,
  serviceBindingPrefix: 'service' as const,
  fixedDims: ['env', 'region', 'svc_name', 'namespace'] as const,
  invariants: [
    '모든 관측 prefix의 svc_ref는 동일한 service 주소를 참조해야 한다',
    'page_view 없이 flow_point가 관측되면 진입점 누락',
    'pattern_anomaly가 발생하면 pattern_match에 unclassified가 있어야 한다',
  ] as const,
} as const;

/** 인프라 계측 DSL — 배포/헬스 이벤트를 서비스 단위로 묶는 DSL. dev/stage/prod 전 환경을 포함한다. */
export const DSL_INFRA = {
  id: 'dsl-infra' as const,
  members: [
    'deploy_event',
    'health_event',
    'endpoint',
    'metric_aggregate',
    'version_state',
  ] as const,
  serviceBindingPrefix: 'service' as const,
  fixedDims: ['env', 'region', 'svc_name', 'namespace'] as const,
  invariants: [
    'deploy_event 직후 health_event(degraded)가 발생하면 배포 실패 후보',
    'health_event(unhealthy) 시 해당 서비스의 endpoint 관측을 중단 감지',
    'version_state(released) 전환 시 metric_aggregate(healthy)가 관측되어야 한다',
  ] as const,
} as const;

/** 결제 흐름 DSL — 결제 흐름의 전체 경로를 추적하는 DSL. 화면 진입 → API 호출 → 흐름 분기 → 주문 이벤트 → 권한. */
export const DSL_CHECKOUT = {
  id: 'dsl-checkout' as const,
  members: ['page_view', 'endpoint', 'flow_point', 'order_event', 'permission'] as const,
  serviceBindingPrefix: 'service' as const,
  fixedDims: ['env', 'region', 'svc_name', 'namespace'] as const,
  invariants: [
    'checkout page_view 없이 checkout flow_point(success)가 관측되면 안 됨',
    'order_event(create) 없이 order_event(complete)가 관측되면 안 됨',
  ] as const,
} as const;

/** 인증/권한 DSL — 인증 이벤트와 권한 관리를 묶는 DSL. auth_event + permission + endpoint. */
export const DSL_AUTH = {
  id: 'dsl-auth' as const,
  members: ['auth_event', 'permission', 'endpoint'] as const,
  serviceBindingPrefix: 'service' as const,
  fixedDims: ['env', 'region', 'svc_name', 'namespace'] as const,
} as const;

/** 커머스 이벤트 DSL — 장바구니/주문 이벤트와 이벤트 로그를 묶는 DSL. cart_event + order_event + event. */
export const DSL_COMMERCE = {
  id: 'dsl-commerce' as const,
  members: ['cart_event', 'order_event', 'event'] as const,
  serviceBindingPrefix: 'service' as const,
  fixedDims: ['env', 'region', 'svc_name', 'namespace'] as const,
} as const;

/** 콘텐츠/행동 DSL — 콘텐츠 분류와 사용자 행동 추적을 묶는 DSL. content + tracking. */
export const DSL_CONTENT = {
  id: 'dsl-content' as const,
  members: ['content', 'tracking', 'tag_lifecycle'] as const,
  serviceBindingPrefix: 'service' as const,
  fixedDims: ['env', 'region', 'svc_name', 'namespace'] as const,
} as const;

/** 접근 제어 DSL — RBAC 모델과 관계 모델을 묶는 DSL. rbac + relational. */
export const DSL_ACCESS_CONTROL = {
  id: 'dsl-access-control' as const,
  members: ['rbac', 'relational'] as const,
  serviceBindingPrefix: 'service' as const,
  fixedDims: ['env', 'region', 'svc_name', 'namespace'] as const,
} as const;

/** 파이프라인 관측 DSL — 수집 파이프라인의 처리 경로와 데이터 정책을 묶는 DSL. 어떤 단계에서 어떤 모드로 어떤 결과가 나왔는가. */
export const DSL_PIPELINE = {
  id: 'dsl-pipeline' as const,
  members: [
    'pipeline_point',
    'data_policy',
    'engine_event',
    'schema_event',
    'endpoint',
    'validation_event',
  ] as const,
  serviceBindingPrefix: 'service' as const,
  fixedDims: ['env', 'region', 'svc_name', 'namespace'] as const,
  invariants: [
    'pipeline_phase=verdict 이전에 pipeline_phase=reconstruct가 선행되어야 한다',
    'validation_mode=strict에서 verdict_result=unknown이 나오면 안 된다',
    'schema_event(migrate) 후 engine_event의 constraint_op 평가가 새 스키마 기준이어야 한다',
    'validation_event는 engine_event와 같은 constraint_op을 공유하되, validation_layer로 레이어를 구분한다',
  ] as const,
} as const;

/** 자기참조 개발 DSL — qa-sdk 모노레포의 빌드/테스트/DKG운영/CLI활동을 좌표계로 추적하는 DSL. */
export const DSL_DEV = {
  id: 'dsl-dev' as const,
  members: [
    'build_event',
    'test_event',
    'dkg_event',
    'dkg_decision_event',
    'dkg_observation_event',
    'cli_event',
    'contract_check',
    'skill_execution',
    'test_coverage',
    'cli_tracking',
  ] as const,
  serviceBindingPrefix: 'service' as const,
  fixedDims: ['env', 'region', 'svc_name', 'namespace'] as const,
  invariants: [
    'build_event(failure) 후 test_event는 발생하면 안 된다 (빌드 실패 시 테스트 불가)',
    'test_event(failed) 발생 시 해당 패키지의 build_event(success)가 선행되어야 한다',
    'dkg_decision_event 없이 dkg_observation_event만 누적되면 의사결정 지연',
  ] as const,
} as const;

/** 내부 로직 관측 DSL — 버전 생명주기/주소 상태/관측 의도/실행 컨텍스트를 서비스 단위로 추적. */
export const DSL_INTERNAL = {
  id: 'dsl-internal' as const,
  members: [
    'version_point',
    'gate_point',
    'observation_event',
    'execution_context',
    'spec_event',
    'edge_activity',
    'version_state',
    'metric_aggregate',
  ] as const,
  serviceBindingPrefix: 'service' as const,
  fixedDims: ['env', 'region', 'svc_name', 'namespace'] as const,
  invariants: [
    'version_point(active) 전환 시 gate_point(active)도 동기화되어야 한다',
    'execution_context(test) 모드에서 gate_point 변경이 발생하면 안 된다',
  ] as const,
} as const;

/** 수집 파이프라인 관측 DSL — 수집 레코드 유형과 스키마 검증을 서비스 단위로 추적. */
export const DSL_INGEST = {
  id: 'dsl-ingest' as const,
  members: [
    'ingest_record',
    'schema_validation',
    'pipeline_point',
    'data_policy',
    'metric_point',
    'metric_aggregate',
  ] as const,
  serviceBindingPrefix: 'service' as const,
  fixedDims: ['env', 'region', 'svc_name', 'namespace'] as const,
  invariants: ['ingest_record(metric) 수집 시 schema_validation이 선행되어야 한다'] as const,
} as const;

/** DSL bundle ID 리터럴 유니온 (11개) */
export type DslId =
  | 'dsl-observation'
  | 'dsl-infra'
  | 'dsl-checkout'
  | 'dsl-auth'
  | 'dsl-commerce'
  | 'dsl-content'
  | 'dsl-access-control'
  | 'dsl-pipeline'
  | 'dsl-dev'
  | 'dsl-internal'
  | 'dsl-ingest';

export const DSL_IDS = [
  'dsl-observation',
  'dsl-infra',
  'dsl-checkout',
  'dsl-auth',
  'dsl-commerce',
  'dsl-content',
  'dsl-access-control',
  'dsl-pipeline',
  'dsl-dev',
  'dsl-internal',
  'dsl-ingest',
] as const;

/** Constraint ID 리터럴 유니온 */
export type ConstraintId =
  | 'CON-001'
  | 'CON-002'
  | 'CON-003'
  | 'CON-004'
  | 'CON-005'
  | 'CON-006'
  | 'CON-007';

/** Domain ID 리터럴 유니온 */
export type DomainId =
  | 'shopping-domain'
  | 'tracking-domain'
  | 'event-domain'
  | 'observation-domain'
  | 'infra-domain'
  | 'dev-domain'
  | 'decision-domain';
