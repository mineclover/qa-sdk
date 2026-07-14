// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * DEMO_CATALOG 기반 예시 Transition Spec 3종.
 *
 * 실제 축 이름과 entry 값을 사용한다.
 * input/output은 축(axis) 기반 — 별도 slot vocabulary 없음.
 *
 * 상태 축 매핑:
 *   flow_step        — 흐름 내 위치 (entry → processing → success)
 *   lifecycle_state   — 자원 생명주기 (draft → active → deprecated)
 *   resource_location — 자원 위치 (origin, cache, queue, external) [신설 예정]
 *   version_lifecycle — 버전 단계 (draft → locked → released)
 */

import type { TransitionSpec } from './transition.types.js';

// ═══════════════════════════════════════════════════════════════
//  1. cart.checkout — 장바구니 결제
//
//  tracking(submit, checkout) → flow_point(checkout, entry)
//  → flow_point(checkout, processing) → order_event(create)
// ═══════════════════════════════════════════════════════════════

export const CART_CHECKOUT_SPEC: TransitionSpec = {
  transition: 'cart.checkout',
  version: 'v1',
  match: {
    mode: 'ordered',
    coordinates: [
      { trackAction: 'submit', page: 'checkout', userType: 'member' },
      { flow_name: 'checkout', flow_step: 'entry', flow_variant: 'default' },
      { flow_name: 'checkout', flow_step: 'processing', flow_variant: 'default' },
      { order_action: 'create' },
    ],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[3].order_id',
  },
  input: {
    all: [
      { axis: 'lifecycle_state', exists: false },
      { axis: 'flow_step', eq: 'entry' },
    ],
  },
  output: {
    set: [
      { axis: 'lifecycle_state', value: 'active' },
      { axis: 'flow_step', value: 'processing' },
      { axis: 'resource_location', value: 'origin' },
    ],
  },
  effect: { kind: 'create' },
};

// ═══════════════════════════════════════════════════════════════
//  2. user.login — 사용자 로그인
//
//  endpoint(POST, api) → auth_event(login)
//  → flow_point(login, success)
// ═══════════════════════════════════════════════════════════════

export const USER_LOGIN_SPEC: TransitionSpec = {
  transition: 'user.login',
  version: 'v1',
  match: {
    mode: 'ordered',
    coordinates: [
      { resource_type: 'api', http_method: 'POST', api_version: 'v1' },
      { auth_action: 'login' },
      { flow_name: 'login', flow_step: 'success', flow_variant: 'default' },
    ],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[1].actor_id',
  },
  input: {
    all: [{ axis: 'lifecycle_state', neq: 'archived' }],
  },
  output: {
    set: [
      { axis: 'lifecycle_state', value: 'active' },
      { axis: 'flow_step', value: 'success' },
    ],
  },
  effect: { kind: 'open' },
};

// ═══════════════════════════════════════════════════════════════
//  3. payment.capture — 결제 완료
//
//  flow_point(checkout, payment) → order_event(complete)
//  → flow_point(checkout, complete)
// ═══════════════════════════════════════════════════════════════

export const PAYMENT_CAPTURE_SPEC: TransitionSpec = {
  transition: 'payment.capture',
  version: 'v1',
  match: {
    mode: 'ordered',
    coordinates: [
      { flow_name: 'checkout', flow_step: 'payment', flow_variant: 'default' },
      { order_action: 'complete' },
      { flow_name: 'checkout', flow_step: 'complete', flow_variant: 'default' },
    ],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[1].order_id',
  },
  input: {
    all: [
      { axis: 'lifecycle_state', eq: 'active' },
      { axis: 'flow_step', eq: 'payment' },
    ],
  },
  output: {
    set: [{ axis: 'flow_step', value: 'complete' }],
  },
  effect: { kind: 'close' },
};

// ═══════════════════════════════════════════════════════════════
//  4. deploy.rollout — 배포 후 헬스 전이 (인프라 도메인)
//
//  deploy_event(deploy) → health_event(healthy|degraded)
// ═══════════════════════════════════════════════════════════════

export const DEPLOY_ROLLOUT_SPEC: TransitionSpec = {
  transition: 'deploy.rollout',
  version: 'v1',
  match: {
    mode: 'ordered',
    coordinates: [{ deploy_action: 'deploy' }, { health_status: 'healthy' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].service_id',
  },
  input: {
    all: [{ axis: 'lifecycle_state', eq: 'active' }],
  },
  output: {
    set: [
      { axis: 'health_status', value: 'healthy' },
      { axis: 'version_lifecycle', value: 'released' },
    ],
  },
  effect: { kind: 'update' },
};

// ═══════════════════════════════════════════════════════════════
//  5. deploy.degraded — 배포 후 성능 저하 (인프라 도메인)
//
//  deploy_event(deploy) → health_event(degraded)
// ═══════════════════════════════════════════════════════════════

export const DEPLOY_DEGRADED_SPEC: TransitionSpec = {
  transition: 'deploy.degraded',
  version: 'v1',
  match: {
    mode: 'ordered',
    coordinates: [{ deploy_action: 'deploy' }, { health_status: 'degraded' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].service_id',
  },
  input: {
    all: [{ axis: 'lifecycle_state', eq: 'active' }],
  },
  output: {
    set: [{ axis: 'health_status', value: 'degraded' }],
  },
  effect: { kind: 'update' },
};

// ═══════════════════════════════════════════════════════════════
//  6. pipeline.ingest — 수집 파이프라인 전이
//
//  pipeline_point(ingest) → pipeline_point(reconstruct) → pipeline_point(verdict)
// ═══════════════════════════════════════════════════════════════

export const PIPELINE_INGEST_SPEC: TransitionSpec = {
  transition: 'pipeline.ingest',
  version: 'v1',
  match: {
    mode: 'ordered',
    coordinates: [
      { pipeline_phase: 'ingest' },
      { pipeline_phase: 'reconstruct' },
      { pipeline_phase: 'verdict' },
    ],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].trace_id',
  },
  input: {
    all: [{ axis: 'lifecycle_state', exists: false }],
  },
  output: {
    set: [
      { axis: 'lifecycle_state', value: 'active' },
      { axis: 'flow_step', value: 'complete' },
    ],
  },
  effect: { kind: 'create' },
};

// ═══════════════════════════════════════════════════════════════
//  7. build.success — 빌드 성공 후 테스트 (자기참조 도메인)
//
//  build_event(success) → test_event(passed)
// ═══════════════════════════════════════════════════════════════

export const BUILD_SUCCESS_SPEC: TransitionSpec = {
  transition: 'build.success',
  version: 'v1',
  match: {
    mode: 'ordered',
    coordinates: [{ build_result: 'success' }, { test_result: 'passed' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].package_id',
  },
  input: {
    all: [{ axis: 'lifecycle_state', exists: false }],
  },
  output: {
    set: [
      { axis: 'lifecycle_state', value: 'active' },
      { axis: 'version_lifecycle', value: 'locked' },
    ],
  },
  effect: { kind: 'create' },
};

// ═══════════════════════════════════════════════════════════════
//  8. permission.grant — 권한 부여 전이
//
//  permission(role=customer → role=admin)
// ═══════════════════════════════════════════════════════════════

export const PERMISSION_GRANT_SPEC: TransitionSpec = {
  transition: 'permission.grant',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ role: 'admin', action: 'write' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].user_id',
  },
  input: {
    all: [{ axis: 'lifecycle_state', eq: 'active' }],
  },
  output: {
    set: [{ axis: 'flow_step', value: 'complete' }],
  },
  effect: { kind: 'update' },
};

// ═══════════════════════════════════════════════════════════════
//  9. pattern.anomaly — 패턴 이상 감지 전이
//
//  pattern_match → pattern_anomaly
// ═══════════════════════════════════════════════════════════════

export const PATTERN_ANOMALY_SPEC: TransitionSpec = {
  transition: 'pattern.anomaly',
  version: 'v1',
  match: {
    mode: 'ordered',
    coordinates: [{ behavior_pattern: 'unclassified' }, { anomaly_kind: 'ratio_shift' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].session_id',
  },
  input: {
    all: [{ axis: 'lifecycle_state', exists: false }],
  },
  output: {
    set: [{ axis: 'lifecycle_state', value: 'active' }],
  },
  effect: { kind: 'open' },
};

// ═══════════════════════════════════════════════════════════════
//  10. cart.add — 장바구니 담기 전이
// ═══════════════════════════════════════════════════════════════

export const CART_ADD_SPEC: TransitionSpec = {
  transition: 'cart.add',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ cart_action: 'add', trackAction: 'add_to_cart' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].item_id',
  },
  input: { all: [{ axis: 'lifecycle_state', eq: 'active' }] },
  output: { set: [{ axis: 'flow_step', value: 'processing' }] },
  effect: { kind: 'update' },
};

// ═══════════════════════════════════════════════════════════════
//  11. content.publish — 콘텐츠 발행
// ═══════════════════════════════════════════════════════════════

export const CONTENT_PUBLISH_SPEC: TransitionSpec = {
  transition: 'content.publish',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ status: 'published', category: 'tech', locale: 'ko' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].content_id',
  },
  input: { all: [{ axis: 'lifecycle_state', eq: 'draft' }] },
  output: { set: [{ axis: 'lifecycle_state', value: 'active' }] },
  effect: { kind: 'update' },
};

// ═══════════════════════════════════════════════════════════════
//  12. rbac.assign — RBAC 역할 할당
// ═══════════════════════════════════════════════════════════════

export const RBAC_ASSIGN_SPEC: TransitionSpec = {
  transition: 'rbac.assign',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ rbac_role: 'editor', resource: 'dashboard' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].user_id',
  },
  input: { all: [{ axis: 'lifecycle_state', eq: 'active' }] },
  output: { set: [{ axis: 'flow_step', value: 'complete' }] },
  effect: { kind: 'update' },
};

// ═══════════════════════════════════════════════════════════════
//  13. dkg.operate — DKG 운영 전이
// ═══════════════════════════════════════════════════════════════

export const DKG_OPERATE_SPEC: TransitionSpec = {
  transition: 'dkg.operate',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ dkg_op: 'observe', dkg_target_kind: 'prefix' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].target_id',
  },
  input: { all: [{ axis: 'lifecycle_state', exists: false }] },
  output: { set: [{ axis: 'lifecycle_state', value: 'active' }] },
  effect: { kind: 'create' },
};

// ═══════════════════════════════════════════════════════════════
//  14. dkg.decide — DKG 의사결정 전이
// ═══════════════════════════════════════════════════════════════

export const DKG_DECIDE_SPEC: TransitionSpec = {
  transition: 'dkg.decide',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ decision_type: 'capacity', node_source: 'manual', dkg_target_kind: 'axis' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].decision_id',
  },
  input: { all: [{ axis: 'lifecycle_state', exists: false }] },
  output: { set: [{ axis: 'lifecycle_state', value: 'active' }] },
  effect: { kind: 'create' },
};

// ═══════════════════════════════════════════════════════════════
//  15. dkg.observe — DKG 관측 기록 전이
// ═══════════════════════════════════════════════════════════════

export const DKG_OBSERVE_SPEC: TransitionSpec = {
  transition: 'dkg.observe',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [
      { obs_source: 'metric', observation_intent: 'action_needed', dkg_target_kind: 'prefix' },
    ],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].observation_id',
  },
  input: { all: [{ axis: 'lifecycle_state', exists: false }] },
  output: { set: [{ axis: 'lifecycle_state', value: 'active' }] },
  effect: { kind: 'open' },
};

// ═══════════════════════════════════════════════════════════════
//  16. cli.execute — CLI 명령 실행 전이
// ═══════════════════════════════════════════════════════════════

export const CLI_EXECUTE_SPEC: TransitionSpec = {
  transition: 'cli.execute',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ cli_intent: 'query', cli_domain: 'dkg-graph', cli_subject: 'prefix' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].command_id',
  },
  input: { all: [{ axis: 'lifecycle_state', exists: false }] },
  output: { set: [{ axis: 'lifecycle_state', value: 'active' }] },
  effect: { kind: 'consume' },
};

// ═══════════════════════════════════════════════════════════════
//  17. schema.validate — 스키마 검증 전이
// ═══════════════════════════════════════════════════════════════

export const SCHEMA_VALIDATE_SPEC: TransitionSpec = {
  transition: 'schema.validate',
  version: 'v1',
  match: {
    mode: 'ordered',
    coordinates: [
      { constraint_rule: 'required', validation_layer: 'structural' },
      { verdict_result: 'pass' },
    ],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].schema_id',
  },
  input: { all: [{ axis: 'lifecycle_state', exists: false }] },
  output: { set: [{ axis: 'lifecycle_state', value: 'active' }] },
  effect: { kind: 'create' },
};

// ═══════════════════════════════════════════════════════════════
//  18. pattern.classify — 패턴 분류 전이
// ═══════════════════════════════════════════════════════════════

export const PATTERN_CLASSIFY_SPEC: TransitionSpec = {
  transition: 'pattern.classify',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ identification_mode: 'identified', pattern_confidence: 'high' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].session_id',
  },
  input: { all: [{ axis: 'lifecycle_state', exists: false }] },
  output: { set: [{ axis: 'lifecycle_state', value: 'active' }] },
  effect: { kind: 'create' },
};

// ═══════════════════════════════════════════════════════════════
//  19. data.mask — 데이터 마스킹 전이
// ═══════════════════════════════════════════════════════════════

export const DATA_MASK_SPEC: TransitionSpec = {
  transition: 'data.mask',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ mask_mode: 'mask', validation_mode: 'strict' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].record_id',
  },
  input: { all: [{ axis: 'lifecycle_state', eq: 'active' }] },
  output: { set: [{ axis: 'flow_step', value: 'complete' }] },
  effect: { kind: 'update' },
};

// ═══════════════════════════════════════════════════════════════
//  20. event.emit — 이벤트 발생 전이
// ═══════════════════════════════════════════════════════════════

export const EVENT_EMIT_SPEC: TransitionSpec = {
  transition: 'event.emit',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ event_name: 'order.created', initiator: 'web' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].event_id',
  },
  input: { all: [{ axis: 'lifecycle_state', eq: 'active' }] },
  output: { set: [{ axis: 'flow_step', value: 'processing' }] },
  effect: { kind: 'create' },
};

// ═══════════════════════════════════════════════════════════════
//  21. relational.bind — 관계형 바인딩 전이
// ═══════════════════════════════════════════════════════════════

export const RELATIONAL_BIND_SPEC: TransitionSpec = {
  transition: 'relational.bind',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ subjectKind: 'user', predicate: 'has', objectKind: 'role' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].relation_id',
  },
  input: { all: [{ axis: 'lifecycle_state', exists: false }] },
  output: { set: [{ axis: 'lifecycle_state', value: 'active' }] },
  effect: { kind: 'create' },
};

// ═══════════════════════════════════════════════════════════════
//  22. skill.execute — 스킬 실행 전이
// ═══════════════════════════════════════════════════════════════

export const SKILL_EXECUTE_SPEC: TransitionSpec = {
  transition: 'skill.execute',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ skill_category: 'analysis', skill_outcome: 'ok' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].skill_run_id',
  },
  input: { all: [{ axis: 'lifecycle_state', eq: 'active' }] },
  output: { set: [{ axis: 'flow_step', value: 'complete' }] },
  effect: { kind: 'close' },
};

// ═══════════════════════════════════════════════════════════════
//  23. engine.evaluate — 엔진 제약 평가 전이
// ═══════════════════════════════════════════════════════════════

export const ENGINE_EVALUATE_SPEC: TransitionSpec = {
  transition: 'engine.evaluate',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ constraint_op: 'eq', verdict_result: 'pass' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].evaluation_id',
  },
  input: { all: [{ axis: 'lifecycle_state', eq: 'active' }] },
  output: { set: [{ axis: 'flow_step', value: 'complete' }] },
  effect: { kind: 'close' },
};

// ═══════════════════════════════════════════════════════════════
//  24. build.package — 패키지 빌드+테스트 전이 (qa_pkg, qa_module)
// ═══════════════════════════════════════════════════════════════

export const BUILD_PACKAGE_SPEC: TransitionSpec = {
  transition: 'build.package',
  version: 'v1',
  match: {
    mode: 'ordered',
    coordinates: [
      { qa_pkg: 'spec-core', qa_module: 'dkg', build_result: 'success' },
      { qa_pkg: 'spec-core', qa_module: 'dkg', test_result: 'passed' },
    ],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].build_id',
  },
  input: { all: [{ axis: 'lifecycle_state', exists: false }] },
  output: { set: [{ axis: 'lifecycle_state', value: 'active' }] },
  effect: { kind: 'create' },
};

// ═══════════════════════════════════════════════════════════════
//  25. contract.check — 계약 검증 전이 (api_surface)
// ═══════════════════════════════════════════════════════════════

export const CONTRACT_CHECK_SPEC: TransitionSpec = {
  transition: 'contract.check',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ api_surface: 'encode-decode', test_result: 'passed' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].contract_id',
  },
  input: { all: [{ axis: 'lifecycle_state', eq: 'active' }] },
  output: { set: [{ axis: 'flow_step', value: 'complete' }] },
  effect: { kind: 'close' },
};

// ═══════════════════════════════════════════════════════════════
//  26. pattern.severity — 이상 심각도 전이 (anomaly_severity)
// ═══════════════════════════════════════════════════════════════

export const PATTERN_SEVERITY_SPEC: TransitionSpec = {
  transition: 'pattern.severity',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ anomaly_kind: 'volume_spike', anomaly_severity: 'critical' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].anomaly_id',
  },
  input: { all: [{ axis: 'lifecycle_state', eq: 'active' }] },
  output: { set: [{ axis: 'health_status', value: 'unhealthy' }] },
  effect: { kind: 'update' },
};

// ═══════════════════════════════════════════════════════════════
//  27. schema.migrate — 스키마 마이그레이션 전이 (migration_pattern, spec_type)
// ═══════════════════════════════════════════════════════════════

export const SCHEMA_MIGRATE_SPEC: TransitionSpec = {
  transition: 'schema.migrate',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ migration_pattern: 'append_dim', spec_type: 'adr' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].migration_id',
  },
  input: { all: [{ axis: 'lifecycle_state', eq: 'active' }] },
  output: { set: [{ axis: 'version_lifecycle', value: 'released' }] },
  effect: { kind: 'update' },
};

// ═══════════════════════════════════════════════════════════════
//  28. metric.record — 메트릭 기록 전이 (metric_type, record_type)
// ═══════════════════════════════════════════════════════════════

export const METRIC_RECORD_SPEC: TransitionSpec = {
  transition: 'metric.record',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ metric_type: 'counter', record_type: 'metric' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].metric_id',
  },
  input: { all: [{ axis: 'lifecycle_state', eq: 'active' }] },
  output: { set: [{ axis: 'flow_step', value: 'complete' }] },
  effect: { kind: 'consume' },
};

// ═══════════════════════════════════════════════════════════════
//  29. edge.activity — 엣지 활동 전이 (edge_type)
// ═══════════════════════════════════════════════════════════════

export const EDGE_ACTIVITY_SPEC: TransitionSpec = {
  transition: 'edge.activity',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ edge_type: 'consumes', dkg_target_kind: 'prefix' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].edge_id',
  },
  input: { all: [{ axis: 'lifecycle_state', eq: 'active' }] },
  output: { set: [{ axis: 'flow_step', value: 'processing' }] },
  effect: { kind: 'update' },
};

// ═══════════════════════════════════════════════════════════════
//  30. gate.check — 게이트 상태 확인 전이 (address_state)
// ═══════════════════════════════════════════════════════════════

export const GATE_CHECK_SPEC: TransitionSpec = {
  transition: 'gate.check',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ address_state: 'active' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].address_id',
  },
  input: { all: [{ axis: 'lifecycle_state', eq: 'active' }] },
  output: { set: [{ axis: 'flow_step', value: 'complete' }] },
  effect: { kind: 'consume' },
};

// ═══════════════════════════════════════════════════════════════
//  31. event.classify — 이벤트 분류 전이 (event_category, event_lifecycle_stage)
// ═══════════════════════════════════════════════════════════════

export const EVENT_CLASSIFY_SPEC: TransitionSpec = {
  transition: 'event.classify',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ event_category: 'user_action', event_lifecycle_stage: 'completion' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].event_id',
  },
  input: { all: [{ axis: 'lifecycle_state', eq: 'active' }] },
  output: { set: [{ axis: 'flow_step', value: 'complete' }] },
  effect: { kind: 'update' },
};

// ═══════════════════════════════════════════════════════════════
//  32. execution.replay — 실행 모드 전이 (execution_mode)
// ═══════════════════════════════════════════════════════════════

export const EXECUTION_REPLAY_SPEC: TransitionSpec = {
  transition: 'execution.replay',
  version: 'v1',
  match: {
    mode: 'single',
    coordinates: [{ execution_mode: 'replay' }],
  },
  bind: {
    context_id: '$.events[0].context_id',
    resource_id: '$.events[0].execution_id',
  },
  input: { all: [{ axis: 'lifecycle_state', eq: 'active' }] },
  output: { set: [{ axis: 'flow_step', value: 'processing' }] },
  effect: { kind: 'consume' },
};

/** DEMO_CATALOG 기반 TransitionSpec 전체 */
export const DEMO_TRANSITION_SPECS: readonly TransitionSpec[] = [
  // shop-web (3)
  CART_CHECKOUT_SPEC,
  USER_LOGIN_SPEC,
  PAYMENT_CAPTURE_SPEC,
  // infra (3)
  DEPLOY_ROLLOUT_SPEC,
  DEPLOY_DEGRADED_SPEC,
  PIPELINE_INGEST_SPEC,
  // dev (1)
  BUILD_SUCCESS_SPEC,
  // 관측 (2)
  PERMISSION_GRANT_SPEC,
  PATTERN_ANOMALY_SPEC,
  // commerce (2)
  CART_ADD_SPEC,
  EVENT_EMIT_SPEC,
  // content (1)
  CONTENT_PUBLISH_SPEC,
  // auth (1)
  RBAC_ASSIGN_SPEC,
  // dkg (3)
  DKG_OPERATE_SPEC,
  DKG_DECIDE_SPEC,
  DKG_OBSERVE_SPEC,
  // cli (1)
  CLI_EXECUTE_SPEC,
  // pipeline (2)
  SCHEMA_VALIDATE_SPEC,
  DATA_MASK_SPEC,
  // pattern (1)
  PATTERN_CLASSIFY_SPEC,
  // relational (1)
  RELATIONAL_BIND_SPEC,
  // skill (1)
  SKILL_EXECUTE_SPEC,
  // engine/schema (3)
  ENGINE_EVALUATE_SPEC,
  SCHEMA_MIGRATE_SPEC,
  CONTRACT_CHECK_SPEC,
  // build (1)
  BUILD_PACKAGE_SPEC,
  // pattern (1)
  PATTERN_SEVERITY_SPEC,
  // metric/record (1)
  METRIC_RECORD_SPEC,
  // dkg extended (2)
  EDGE_ACTIVITY_SPEC,
  GATE_CHECK_SPEC,
  // event/execution (2)
  EVENT_CLASSIFY_SPEC,
  EXECUTION_REPLAY_SPEC,
] as const;
