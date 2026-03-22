/**
 * DEMO_DKG_CONFIG — DKG bootstrap 설정 데이터 (SSOT).
 * bootstrap.ts의 하드코딩 데이터를 선언적 구조로 추출.
 */

export const DEMO_DKG_CONFIG = {
  domains: [
    {
      kind: "domain", id: "shopping-domain", name: "쇼핑 서비스 도메인",
      prefixes: ["permission", "event", "service", "rbac"],
      sharedAxes: ["env", "region", "svc_name", "namespace", "role"],
      boundary: { exports: ["permission", "event", "rbac"], internal: ["service"] },
      rationale: "권한/역할/이벤트가 동일한 서비스 컨텍스트를 공유하는 도메인. rbac은 permission과 같은 접근 제어 계열.",
    },
    {
      kind: "domain", id: "tracking-domain", name: "행동 추적 도메인",
      prefixes: ["tracking", "content", "relational"],
      sharedAxes: ["channel", "locale"],
      boundary: { exports: ["tracking", "relational"], internal: ["content"] },
      rationale: "사용자 행동과 콘텐츠가 같은 채널/로케일 컨텍스트를 공유. relational은 행동 간 관계 모델.",
    },
    {
      kind: "domain", id: "event-domain", name: "이벤트 도메인",
      prefixes: ["cart_event", "auth_event", "order_event"],
      sharedAxes: [],
      boundary: { exports: ["cart_event", "auth_event", "order_event"], internal: [] },
      rationale: "table_ref 기반 이벤트 prefix 그룹",
    },
    {
      kind: "domain", id: "observation-domain", name: "관측 도메인",
      prefixes: ["page_view", "endpoint", "flow_point", "tracking", "pipeline_point", "data_policy", "engine_event", "schema_event", "pattern_match", "pattern_anomaly", "event_classification", "schema_validation"],
      sharedAxes: ["behavior_pattern", "identification_mode", "event_category", "event_lifecycle_stage"],
      boundary: { exports: ["page_view", "endpoint", "flow_point", "pipeline_point", "data_policy", "engine_event", "schema_event", "pattern_match", "pattern_anomaly", "event_classification", "schema_validation"], internal: [] },
      rationale: "비즈니스/파이프라인/엔진/스키마 관측 + 패턴 분류 + 이벤트 분류. svc_ref 공유.",
    },
    {
      kind: "domain", id: "infra-domain", name: "인프라 도메인",
      prefixes: ["deploy_event", "health_event", "ingest_record", "metric_point", "execution_context"],
      sharedAxes: ["deploy_action", "health_status", "record_type", "metric_type", "execution_mode"],
      boundary: { exports: ["deploy_event", "health_event", "ingest_record", "metric_point"], internal: ["execution_context"] },
      rationale: "인프라 계측 + 수집/메트릭 관측. 전 환경(dev/stage/prod) 대상.",
    },
    {
      kind: "domain", id: "dev-domain", name: "자기참조 개발 도메인",
      prefixes: ["build_event", "test_event", "dkg_event", "dkg_decision_event", "dkg_observation_event", "contract_check", "cli_event", "skill_execution", "observation_event", "spec_event", "edge_activity", "version_point", "gate_point"],
      sharedAxes: ["qa_pkg", "dkg_op", "dkg_target_kind", "cli_intent", "cli_domain", "cli_subject", "skill_id", "skill_category", "edge_type", "observation_intent", "version_lifecycle", "address_state"],
      boundary: { exports: ["build_event", "test_event", "dkg_event", "dkg_decision_event", "dkg_observation_event", "contract_check", "cli_event", "skill_execution", "observation_event", "spec_event", "edge_activity"], internal: ["version_point", "gate_point"] },
      rationale: "qa-sdk 모노레포 자체의 빌드/테스트/DKG운영/CLI/내부 로직 관측 전체를 좌표계로 추적. 완전 자기참조 모니터링.",
    },
  ],

  consumers: [
    {
      kind: "consumer", id: "platform-demo", type: "client",
      intendedPrefixes: ["permission", "service", "tracking", "rbac", "content", "page_view", "endpoint", "flow_point"],
      rationale: "데모 클라이언트는 전체 prefix를 시뮬레이션한다. dsl-observation, dsl-checkout 사용.",
    },
    {
      kind: "consumer", id: "ingest-server", type: "service",
      intendedPrefixes: ["event", "permission", "service", "endpoint", "deploy_event", "health_event", "pipeline_point", "data_policy"],
      rationale: "수집 서버는 이벤트 수신 + 주소 컨텍스트 태깅 + 인프라 이벤트 수집 + 파이프라인 자체 관측. dsl-infra, dsl-pipeline 사용.",
    },
    {
      kind: "consumer", id: "convergence-pipeline", type: "service",
      intendedPrefixes: ["pattern_match", "pattern_anomaly", "flow_point", "endpoint", "page_view"],
      rationale: "수렴 파이프라인은 세션별 패턴 분류 결과를 pattern_match/pattern_anomaly prefix로 기록하고, 관측 포인트에서 행동 흐름을 분석한다.",
    },
  ],

  constraints: [
    {
      kind: "constraint", id: "CON-001",
      rule: "rbac_role과 role은 별개 도메인이다. 같은 prefix에 동시 사용 금지.",
      formal: "NOT EXISTS(prefix p WHERE p.dims HAS 'rbac_role' AND p.dims HAS 'role')",
      scope: ["rbac_role", "role"],
      lifecycle: "active",
    },
    {
      kind: "constraint", id: "CON-002",
      rule: "이벤트 prefix의 action 차원은 해당 도메인의 *_action 축을 사용해야 한다.",
      scope: ["cart_event", "auth_event", "order_event"],
      lifecycle: "active",
    },
    {
      kind: "constraint", id: "CON-003",
      rule: "DSL 번들의 관측/인프라 멤버는 svc_ref(→service) 차원을 가져야 한다. 서비스 바인딩 없는 관측은 추적 불가.",
      scope: ["page_view", "endpoint", "flow_point", "deploy_event", "health_event"],
      lifecycle: "active",
    },
    {
      kind: "constraint", id: "CON-004",
      rule: "패턴 분류율(classificationRate)은 80% 이상이어야 한다. 미달 시 새 패턴 규칙 추가를 검토해야 한다.",
      formal: "classificationRate >= 0.8",
      scope: ["pattern_match", "pattern_anomaly"],
      lifecycle: "active",
    },
    {
      kind: "constraint", id: "CON-005",
      rule: "pattern_anomaly(critical)가 발생하면 자동으로 action-needed observation이 생성되어야 한다.",
      scope: ["pattern_anomaly"],
      lifecycle: "active",
    },
  ],

  dslBundles: [
    {
      kind: "dsl-bundle", id: "dsl-observation", name: "관측 DSL",
      description: "화면/API/흐름 관측 포인트 + 패턴 분류를 서비스 단위로 묶는 DSL. 모든 관측 prefix가 동일한 svc_ref를 공유한다.",
      memberPrefixes: ["page_view", "endpoint", "flow_point", "pattern_match", "pattern_anomaly", "event_classification"],
      serviceBindingPrefix: "service", fixedDims: ["env", "region", "svc_name", "namespace"],
      invariants: [
        "모든 관측 prefix의 svc_ref는 동일한 service 주소를 참조해야 한다",
        "page_view 없이 flow_point가 관측되면 진입점 누락",
        "pattern_anomaly가 발생하면 pattern_match에 unclassified가 있어야 한다",
      ],
    },
    {
      kind: "dsl-bundle", id: "dsl-infra", name: "인프라 계측 DSL",
      description: "배포/헬스 이벤트를 서비스 단위로 묶는 DSL. dev/stage/prod 전 환경을 포함한다.",
      memberPrefixes: ["deploy_event", "health_event", "endpoint"],
      serviceBindingPrefix: "service", fixedDims: ["env", "region", "svc_name", "namespace"],
      invariants: [
        "deploy_event 직후 health_event(degraded)가 발생하면 배포 실패 후보",
        "health_event(unhealthy) 시 해당 서비스의 endpoint 관측을 중단 감지",
      ],
    },
    {
      kind: "dsl-bundle", id: "dsl-checkout", name: "결제 흐름 DSL",
      description: "결제 흐름의 전체 경로를 추적하는 DSL. 화면 진입 → API 호출 → 흐름 분기 → 주문 이벤트 → 권한.",
      memberPrefixes: ["page_view", "endpoint", "flow_point", "order_event", "permission"],
      serviceBindingPrefix: "service", fixedDims: ["env", "region", "svc_name", "namespace"],
      invariants: [
        "checkout page_view 없이 checkout flow_point(success)가 관측되면 안 됨",
        "order_event(create) 없이 order_event(complete)가 관측되면 안 됨",
      ],
    },
    {
      kind: "dsl-bundle", id: "dsl-auth", name: "인증/권한 DSL",
      description: "인증 이벤트와 권한 관리를 묶는 DSL. auth_event + permission + endpoint.",
      memberPrefixes: ["auth_event", "permission", "endpoint"],
      serviceBindingPrefix: "service", fixedDims: ["env", "region", "svc_name", "namespace"],
    },
    {
      kind: "dsl-bundle", id: "dsl-commerce", name: "커머스 이벤트 DSL",
      description: "장바구니/주문 이벤트와 이벤트 로그를 묶는 DSL. cart_event + order_event + event.",
      memberPrefixes: ["cart_event", "order_event", "event"],
      serviceBindingPrefix: "service", fixedDims: ["env", "region", "svc_name", "namespace"],
    },
    {
      kind: "dsl-bundle", id: "dsl-content", name: "콘텐츠/행동 DSL",
      description: "콘텐츠 분류와 사용자 행동 추적을 묶는 DSL. content + tracking.",
      memberPrefixes: ["content", "tracking"],
      serviceBindingPrefix: "service", fixedDims: ["env", "region", "svc_name", "namespace"],
    },
    {
      kind: "dsl-bundle", id: "dsl-access-control", name: "접근 제어 DSL",
      description: "RBAC 모델과 관계 모델을 묶는 DSL. rbac + relational.",
      memberPrefixes: ["rbac", "relational"],
      serviceBindingPrefix: "service", fixedDims: ["env", "region", "svc_name", "namespace"],
    },
    {
      kind: "dsl-bundle", id: "dsl-pipeline", name: "파이프라인 관측 DSL",
      description: "수집 파이프라인의 처리 경로와 데이터 정책을 묶는 DSL. 어떤 단계에서 어떤 모드로 어떤 결과가 나왔는가.",
      memberPrefixes: ["pipeline_point", "data_policy", "engine_event", "schema_event", "endpoint"],
      serviceBindingPrefix: "service", fixedDims: ["env", "region", "svc_name", "namespace"],
      invariants: [
        "pipeline_phase=verdict 이전에 pipeline_phase=reconstruct가 선행되어야 한다",
        "validation_mode=strict에서 verdict_result=unknown이 나오면 안 된다",
        "schema_event(migrate) 후 engine_event의 constraint_op 평가가 새 스키마 기준이어야 한다",
      ],
    },
    {
      kind: "dsl-bundle", id: "dsl-dev", name: "자기참조 개발 DSL",
      description: "qa-sdk 모노레포의 빌드/테스트/DKG운영/CLI활동을 좌표계로 추적하는 DSL.",
      memberPrefixes: ["build_event", "test_event", "dkg_event", "dkg_decision_event", "dkg_observation_event", "cli_event", "contract_check", "skill_execution"],
      serviceBindingPrefix: "service", fixedDims: ["env", "region", "svc_name", "namespace"],
      invariants: [
        "build_event(failure) 후 test_event는 발생하면 안 된다 (빌드 실패 시 테스트 불가)",
        "test_event(failed) 발생 시 해당 패키지의 build_event(success)가 선행되어야 한다",
        "dkg_decision_event 없이 dkg_observation_event만 누적되면 의사결정 지연",
      ],
    },
    {
      kind: "dsl-bundle", id: "dsl-internal", name: "내부 로직 관측 DSL",
      description: "버전 생명주기/주소 상태/관측 의도/실행 컨텍스트를 서비스 단위로 추적.",
      memberPrefixes: ["version_point", "gate_point", "observation_event", "execution_context", "spec_event", "edge_activity"],
      serviceBindingPrefix: "service", fixedDims: ["env", "region", "svc_name", "namespace"],
      invariants: [
        "version_point(active) 전환 시 gate_point(active)도 동기화되어야 한다",
        "execution_context(test) 모드에서 gate_point 변경이 발생하면 안 된다",
      ],
    },
    {
      kind: "dsl-bundle", id: "dsl-ingest", name: "수집 파이프라인 관측 DSL",
      description: "수집 레코드 유형과 스키마 검증을 서비스 단위로 추적.",
      memberPrefixes: ["ingest_record", "schema_validation", "pipeline_point", "data_policy", "metric_point"],
      serviceBindingPrefix: "service", fixedDims: ["env", "region", "svc_name", "namespace"],
      invariants: [
        "ingest_record(metric) 수집 시 schema_validation이 선행되어야 한다",
      ],
    },
  ],

  intentLinks: [
    {
      kind: "intent-link", id: "IL-checkout-flow",
      endpoints: ["page_view", "endpoint", "flow_point", "order_event", "permission"],
      via: "service",
      intent: "결제 흐름: 화면 진입 → API 호출 → 흐름 분기 → 주문 이벤트가 동일 서비스 컨텍스트에서 추적된다",
      invariant: "checkout page_view 없이 checkout flow_point(success)가 관측되면 안 됨",
    },
    {
      kind: "intent-link", id: "IL-api-event",
      endpoints: ["endpoint", "event"],
      via: "service",
      intent: "API 호출과 이벤트 발생이 동일한 서비스 컨텍스트에서 추적된다",
    },
    {
      kind: "intent-link", id: "IL-infra-impact",
      endpoints: ["deploy_event", "health_event", "endpoint"],
      via: "service",
      intent: "인프라 변경(배포/헬스) → API 영향을 동일 서비스 컨텍스트에서 추적한다",
      invariant: "deploy_event 직후 health_event(degraded) 발생 시 배포 실패 후보 탐지",
    },
    {
      kind: "intent-link", id: "IL-pattern-observation",
      endpoints: ["pattern_match", "pattern_anomaly", "flow_point"],
      via: "service",
      intent: "패턴 분류 결과(pattern_match)와 이상 감지(pattern_anomaly)가 흐름 관측(flow_point)과 동일 서비스 컨텍스트에서 연결된다",
      invariant: "pattern_anomaly(unclassified) 발생 시 해당 세션의 flow_point 시퀀스가 새 패턴 규칙의 근거가 된다",
    },
  ],

  skills: [
    // ── 범용 read ──────────────────────────────────────────
    {
      kind: "skill", id: "skill-trace", name: "역추적",
      description: "임의 노드에서 구성/소속/제약/인과 체인/의도 링크/토폴로지/cascade를 한 흐름으로 추적",
      category: "read", targetKinds: ["prefix", "axis", "decision", "observation", "dsl-bundle"],
      input: "nodeId", output: "TraceResult",
    },
    {
      kind: "skill", id: "skill-explore-service", name: "서비스 프로파일",
      description: "서비스 단위 전체 프로파일: 소유/소비 prefix, 계약, DSL, 의존, 관측/결정",
      category: "read", targetKinds: ["prefix"],
      input: "serviceId", output: "ServiceProfile",
    },
    {
      kind: "skill", id: "skill-explore-prefix", name: "prefix 프로파일",
      description: "prefix 단위 심층 프로파일: 차원, headroom, 소유/소비, domain, DSL, 제약",
      category: "read", targetKinds: ["prefix"],
      input: "prefixId", output: "PrefixProfile",
    },
    {
      kind: "skill", id: "skill-explore-dsl", name: "DSL 프로파일",
      description: "DSL 번들 프로파일: 멤버, 서비스 바인딩, 불변조건, 버전 스큐",
      category: "read", targetKinds: ["dsl-bundle"],
      input: "dslId", output: "DslProfile",
    },
    {
      kind: "skill", id: "skill-system-overview", name: "시스템 대시보드",
      description: "서비스별 현황, 위험 지점, 의존 그래프, 도메인 건강 종합",
      category: "read", targetKinds: [],
      input: "(없음)", output: "SystemOverview",
    },

    // ── 범용 write (좌표) ──────────────────────────────────
    {
      kind: "skill", id: "skill-record-decision", name: "의사결정 기록",
      description: "대상 노드에 대한 의사결정을 구조화하여 DKG에 기록. 변경 유형별 자동 대안/반전 조건 생성",
      category: "write", targetKinds: ["prefix", "axis", "dsl-bundle"],
      input: "targetId + type + title + rationale", output: "DecisionNode + governs edge",
      depends: ["skill-decision-scaffold"],
    },
    {
      kind: "skill", id: "skill-record-observation", name: "관측 기록",
      description: "대상 노드에 대한 관측을 DKG에 기록. intent 분류: action-needed(조치 필요, metric이 감지한 문제), monitoring(추적 관찰, 설계 메모), completed(완료 보고, resolve 대상). health metric은 action-needed만 issue로 집계",
      category: "write", targetKinds: ["prefix", "axis", "dsl-bundle", "decision"],
      input: "targetId + finding + intent? + suggestion?", output: "ObservationNode + observes edge",
    },
    {
      kind: "skill", id: "skill-claim", name: "작업 선점",
      description: "대상 노드에 작업중 표시. 영향 범위(owner/consumer/domain/DSL/intent-link) 자동 전파",
      category: "write", targetKinds: ["prefix", "axis"],
      input: "targetId + by", output: "ClaimData + ClaimImpact",
    },
    {
      kind: "skill", id: "skill-release", name: "작업 해제",
      description: "작업 완료. claim 해제 + 완료 observation 자동 생성",
      category: "write", targetKinds: ["prefix", "axis"],
      input: "targetId", output: "ObservationNode + observes edge",
      depends: ["skill-claim"],
    },
    {
      kind: "skill", id: "skill-lifecycle-transition", name: "lifecycle 전이",
      description: "prefix/decision/observation 상태 전이 (draft→active→deprecated→archived). 전이 기록 + VersionEvent 생성",
      category: "write", targetKinds: ["prefix", "decision", "observation"],
      input: "nodeId + toLifecycle", output: "TransitionResult",
    },

    // ── 전문 analysis — 결제/커머스 ──────────────────────────
    {
      kind: "skill", id: "skill-checkout-flow-verify", name: "결제 흐름 불변조건 검증",
      description: "dsl-checkout의 결제 흐름 불변조건 검증: 화면 진입→API→흐름 분기→주문 이벤트→권한이 동일 서비스 컨텍스트에서 추적되는지 확인",
      category: "analysis", targetKinds: ["prefix", "intent-link"],
      input: "address_context records", output: "FlowTraceResult + 위반 ObservationNode",
      specialization: {
        dslBundles: ["dsl-checkout"],
        prefixes: ["page_view", "endpoint", "flow_point", "order_event", "permission"],
        intentLinks: ["IL-checkout-flow"],
        invariants: [
          "checkout page_view 없이 checkout flow_point(success)가 관측되면 안 됨",
          "order_event(create) 없이 order_event(complete)가 관측되면 안 됨",
        ],
      },
    },
    {
      kind: "skill", id: "skill-commerce-skew-audit", name: "커머스 버전 정렬 감사",
      description: "dsl-commerce/dsl-checkout 내 멤버 prefix 간 버전 격차 감지. 빠른 멤버(permission, event)와 느린 멤버(order_event, cart_event) 간 호환성 판단",
      category: "analysis", targetKinds: ["prefix", "dsl-bundle"],
      input: "dslBundleId", output: "DslVersionSkewReport + ObservationNode",
      specialization: {
        dslBundles: ["dsl-checkout", "dsl-commerce"],
        prefixes: ["permission", "event", "order_event", "cart_event", "page_view", "endpoint", "flow_point"],
        metrics: ["metric:skew"],
      },
    },

    // ── 전문 analysis — 관측/인프라 ─────────────────────────
    {
      kind: "skill", id: "skill-observation-coverage", name: "관측 커버리지 감사",
      description: "observation-domain prefix의 entry 관측 커버리지 분석. dormant(정의됐지만 미관측)/phantom(미정의지만 관측) 탐지",
      category: "analysis", targetKinds: ["prefix"],
      input: "UsageData", output: "CoverageAuditResult + ObservationNode",
      specialization: {
        domains: ["observation-domain"],
        dslBundles: ["dsl-observation"],
        prefixes: ["page_view", "endpoint", "flow_point"],
        metrics: ["metric:coverage"],
      },
    },
    {
      kind: "skill", id: "skill-infra-impact-verify", name: "인프라 변경 영향 검증",
      description: "dsl-infra의 배포/헬스 인과 관계 검증. deploy_event 직후 health_event(degraded) 발생 시 배포 실패 후보 탐지, endpoint 관측 중단 감지",
      category: "analysis", targetKinds: ["prefix", "intent-link"],
      input: "address_context records", output: "FlowTraceResult + 위반 ObservationNode",
      specialization: {
        dslBundles: ["dsl-infra"],
        prefixes: ["deploy_event", "health_event", "endpoint"],
        intentLinks: ["IL-infra-impact"],
        invariants: [
          "deploy_event 직후 health_event(degraded)가 발생하면 배포 실패 후보",
          "health_event(unhealthy) 시 해당 서비스의 endpoint 관측을 중단 감지",
        ],
      },
    },
    {
      kind: "skill", id: "skill-pipeline-phase-verify", name: "파이프라인 단계 순서 검증",
      description: "dsl-pipeline의 처리 단계 순서 불변조건 검증. reconstruct→verdict 선후, strict 모드 unknown 금지, 스키마 마이그레이션 후 평가 기준 일관성",
      category: "analysis", targetKinds: ["prefix"],
      input: "address_context records", output: "FlowTraceResult + 위반 ObservationNode",
      specialization: {
        dslBundles: ["dsl-pipeline"],
        prefixes: ["pipeline_point", "data_policy", "engine_event", "schema_event", "endpoint"],
        invariants: [
          "pipeline_phase=verdict 이전에 pipeline_phase=reconstruct가 선행되어야 한다",
          "validation_mode=strict에서 verdict_result=unknown이 나오면 안 된다",
          "schema_event(migrate) 후 engine_event의 constraint_op 평가가 새 스키마 기준이어야 한다",
        ],
      },
    },

    {
      kind: "skill", id: "skill-schema-health-audit", name: "스키마 카테고리 건전성 감사",
      description: "전체 prefix의 카테고리 규칙 적합성 검증. 위반 건 → ObservationNode 생성, 심각 위반 → DecisionNode scaffold. schema_validation prefix 좌표로 인코딩",
      category: "analysis", targetKinds: ["prefix"],
      input: "(없음)", output: "SchemaHealthReport (observations + decisions)",
      specialization: {
        prefixes: ["schema_validation"],
        metrics: ["metric:schema:violations"],
      },
    },

    // ── 전문 analysis — 패턴 분류 ─────────────────────────
    {
      kind: "skill", id: "skill-pattern-analysis", name: "패턴 분류 분석",
      description: "세션 이벤트 시퀀스를 행동 패턴으로 분류하고 이상 패턴을 감지한다. classifyPattern + detectAnomalies + buildPatternHealthReport 조합.",
      category: "analysis", targetKinds: ["prefix"],
      input: "ClassifierInput[] + PatternRule[]", output: "PatternHealthReport + PatternAnomaly[]",
      specialization: {
        domains: ["observation-domain"],
        dslBundles: ["dsl-observation"],
        prefixes: ["pattern_match", "pattern_anomaly"],
        constraints: ["CON-004", "CON-005"],
      },
    },

    // ── 전문 analysis — 제약/구조 ───────────────────────────
    {
      kind: "skill", id: "skill-event-action-check", name: "이벤트 action 축 규칙 검사",
      description: "CON-002 강제: 이벤트 prefix의 action 차원이 해당 도메인의 *_action 축을 사용하는지 검증",
      category: "analysis", targetKinds: ["prefix"],
      input: "prefixId", output: "ConstraintCheckResult",
      specialization: {
        domains: ["event-domain"],
        prefixes: ["cart_event", "auth_event", "order_event"],
        constraints: ["CON-002"],
      },
    },
    {
      kind: "skill", id: "skill-svc-binding-check", name: "서비스 바인딩 검사",
      description: "CON-003 강제: DSL 번들의 관측/인프라 멤버가 svc_ref(→service) 차원을 갖는지 검증. 서비스 바인딩 없는 관측은 추적 불가",
      category: "analysis", targetKinds: ["prefix"],
      input: "prefixId or dslBundleId", output: "ConstraintCheckResult",
      specialization: {
        dslBundles: ["dsl-observation", "dsl-infra", "dsl-pipeline"],
        prefixes: ["page_view", "endpoint", "flow_point", "deploy_event", "health_event", "pipeline_point", "data_policy", "engine_event", "schema_event"],
        constraints: ["CON-003"],
      },
    },
    {
      kind: "skill", id: "skill-safe-entry-add", name: "축 entry 안전 추가",
      description: "축에 새 entry 추가 시 headroom/stride-break/constraint 종합 판정. 영향받는 prefix/DSL/consumer cascade 분석",
      category: "analysis", targetKinds: ["axis"],
      input: "axisId + entry", output: "SafeEntryAddResult (verdict: safe|needs-capacity|...)",
      specialization: {
        metrics: ["metric:headroom"],
      },
    },
    {
      kind: "skill", id: "skill-decision-scaffold", name: "의사결정 스캐폴드",
      description: "변경 유형별(capacity/new-axis/new-prefix/dim-add/merge/deprecate) Decision 템플릿 자동 생성. 대안/반전 조건 포함",
      category: "analysis", targetKinds: ["prefix", "axis"],
      input: "ScaffoldInput", output: "DecisionNode",
    },
    {
      kind: "skill", id: "skill-analyze-impact", name: "변경 영향 cascade 분석",
      description: "축/prefix 변경 시 cascade 범위: 영향 prefix → domain → consumer → DSL → intent-link 파손 분석",
      category: "analysis", targetKinds: ["axis", "prefix"],
      input: "ImpactAnalysisInput", output: "ImpactAnalysisResult",
    },
    {
      kind: "skill", id: "skill-infer-migrator", name: "마이그레이션 패턴 추론",
      description: "prefix version diff에서 migrator 패턴(identity/append-dim/remove-dim/reorder/composite) + 변환 함수 자동 추론",
      category: "analysis", targetKinds: ["prefix"],
      input: "DiffInfo", output: "InferredMigrator",
    },
    {
      kind: "skill", id: "skill-domain-health", name: "도메인 건강 진단",
      description: "도메인 단위 prefix 정합성 + constraint 위반 + boundary 검사 + intent-link invariant 정보",
      category: "analysis", targetKinds: ["domain"],
      input: "domainId", output: "DomainHealthResult",
      specialization: {
        domains: ["shopping-domain", "tracking-domain", "event-domain", "observation-domain", "infra-domain"],
        metrics: ["metric:health"],
      },
    },

    // ── chain ──────────────────────────────────────────────
    {
      kind: "skill", id: "skill-entry-add-chain", name: "entry 추가 체인",
      description: "safe-entry-add → constraint-check → domain-health → decision-scaffold. 축 entry 추가의 전체 판정→기록 워크플로우",
      category: "chain", targetKinds: ["axis"],
      input: "axisId + entry", output: "SkillChainResult",
      depends: ["skill-safe-entry-add", "skill-event-action-check", "skill-domain-health", "skill-decision-scaffold"],
    },
    {
      kind: "skill", id: "skill-system-health-chain", name: "시스템 건강 체인",
      description: "전 도메인 constraint 검사 → 건강 진단 → 커버리지 감사 + metric 수집. health metric은 action-needed observation만 issue로 집계 (monitoring/completed/Decision-acknowledged 제외)",
      category: "chain", targetKinds: [],
      input: "(없음)", output: "SkillChainResult",
      depends: ["skill-event-action-check", "skill-svc-binding-check", "skill-domain-health", "skill-observation-coverage", "skill-schema-health-audit"],
      specialization: {
        metrics: ["metric:health", "metric:conflict:decisions", "metric:overlap", "metric:schema:violations"],
      },
    },
    {
      kind: "skill", id: "skill-converge-chain", name: "수렴 체인",
      description: "merge(축/prefix 중복) + deactivate(dormant) + simplify + observe. 축 중복과 비활성 entry 정리 워크플로우",
      category: "chain", targetKinds: ["axis", "prefix"],
      input: "UsageData", output: "ConvergeChainResult",
    },

    // ── 이 세션에서 추가된 skill ──────────────────────────
    {
      kind: "skill", id: "skill-self-check-analyze", name: "자기진단 분석",
      description: "SelfCheckResult[] → 좌표 인코딩 + aggregateUsageData + convergence + invariant 검증. Layer 2 순수 함수. execSync 없음.",
      category: "analysis", targetKinds: ["system"],
      input: "SelfCheckResult[] + DemoCatalog", output: "SelfCheckAnalysis",
      specialization: { dslBundles: ["dsl-dev"], metrics: ["metric:health"] },
    },
    {
      kind: "skill", id: "skill-cli-coverage", name: "CLI 커버리지 분석",
      description: "69개 CLI 명령의 47개 고유 좌표 중 관측된 것 vs dormant 감지. 한 번도 실행 안 된 기능 경로 식별.",
      category: "analysis", targetKinds: ["system"],
      input: "store (entryUsage 스캔)", output: "{ totalCoords, observedCoords, dormantCoords, coverageRate }",
      specialization: { prefixes: ["cli_event"], metrics: ["metric:coverage"] },
    },
    {
      kind: "skill", id: "skill-promote-scan", name: "좌표 승격 스캔",
      description: "DKG 노드 열거형 필드를 5Q Checklist로 자동 판정하여 축 승격 후보 제안. Level 1(열거형) → Level 2(좌표축) 경로.",
      category: "analysis", targetKinds: ["axis", "prefix"],
      input: "GraphRegistry + existingAxes", output: "PromotionCandidate[]",
    },
    {
      kind: "skill", id: "skill-spec-manage", name: "스펙 문서 관리",
      description: "SpecNode CRUD + lifecycle 전이 + spec_event 기록. dkg spec add/list/transition.",
      category: "write", targetKinds: ["spec"],
      input: "id + type + title + rationale?", output: "SpecNode + governs edges",
    },
    {
      kind: "skill", id: "skill-registry-publish", name: "레지스트리 발행",
      description: "catalogToSchemaSnapshot → registry import + lock → release → activate lifecycle. dkg publish + dkg version.",
      category: "write", targetKinds: ["system"],
      input: "DemoCatalog + registryUrl", output: "PublishResult + VersionStatus",
      specialization: { prefixes: ["version_point"] },
    },
  ],

  specs: [
    { kind: "spec", id: "SPEC-IDENTITY", type: "req", title: "차원 압축 기반 DSL DB 정체성", lifecycle: "active", governs: [] },
    { kind: "spec", id: "SPEC-5Q", type: "adr", title: "축 선택 5Q Checklist", lifecycle: "active", governs: [] },
    { kind: "spec", id: "SPEC-AXIS-BOUNDARY", type: "adr", title: "축에 넣을 것과 넣지 않을 것", lifecycle: "active", governs: ["endpoint"] },
    { kind: "spec", id: "SPEC-CATEGORY-RULES", type: "ls", title: "카테고리별 prefix 타입 규칙 (6종)", lifecycle: "active", governs: ["permission", "rbac"] },
    { kind: "spec", id: "SPEC-DECISION-STD", type: "feat", title: "의사결정 표준 프로세스 7Q", lifecycle: "active", governs: [] },
    { kind: "spec", id: "SPEC-PROPAGATION", type: "feat", title: "스펙 전파 파이프라인 (publish→seal→activate)", lifecycle: "active", governs: ["service"] },
    { kind: "spec", id: "SPEC-TEMPORAL", type: "req", title: "시간 순서와 데이터 흐름 수집", lifecycle: "draft", governs: [] },
  ],

  decisions: [
    {
      kind: "decision", id: "DEC-NEW-AXIS-resource_location",
      date: "2026-03-22",
      title: "resource_location 축 신설 — 자원 물리적 위치 추적",
      context: "Transition Spec DSL의 move effect를 표현하려면 자원이 어디에 있는지(origin/cache/queue/external) 추적하는 축이 필요하다.",
      rationale: "5Q 충족: 유한(4종) / 의사결정(읽기 경로 분기) / 공유(여러 prefix) / 안정(인프라 유형) / capacity 8. 기존 resource_type(api/page/webhook)은 논리적 유형이고, resource_location은 물리적 위치로 의미가 다르다.",
      lifecycle: "active",
    },
  ],

  transitionSpecs: [
    {
      kind: "transition-spec", id: "TSPEC-cart-checkout",
      transition: "cart.checkout", version: "v1",
      matchMode: "ordered", coordinateCount: 4,
      effectKind: "create",
      slotRefs: ["lifecycle_state", "flow_step", "resource_location", "trackAction", "page", "order_action"],
    },
    {
      kind: "transition-spec", id: "TSPEC-user-login",
      transition: "user.login", version: "v1",
      matchMode: "ordered", coordinateCount: 3,
      effectKind: "open",
      slotRefs: ["lifecycle_state", "flow_step", "auth_action", "resource_type", "http_method"],
    },
    {
      kind: "transition-spec", id: "TSPEC-payment-capture",
      transition: "payment.capture", version: "v1",
      matchMode: "ordered", coordinateCount: 3,
      effectKind: "close",
      slotRefs: ["lifecycle_state", "flow_step", "resource_location", "order_action"],
    },
  ],

  reviewPairs: [
    { a: "tracking", b: "page_view", reason: "tracking은 행동 분석(trackAction), page_view는 서비스별 화면 관측(svc_ref). 목적과 서비스 바인딩이 다름." },
  ],
} as const;
