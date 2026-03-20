/**
 * DKG 초기 부트스트랩 — DEMO_CATALOG 파생 + 메타데이터 등록.
 *
 * deriveFromCatalog로 구조를 파생한 후,
 * Domain, Consumer, Constraint 등 설계 메타데이터를 등록한다.
 */

import { DEMO_CATALOG } from "demo-snapshot";
import { GraphRegistry } from "./graph-registry.js";
import { deriveFromCatalog } from "./catalog-derive.js";
import type { DomainNode, ConsumerNode, ConstraintNode, IntentLinkNode, DslBundleNode, ObservationNode, DecisionNode, SpecNode } from "./dkg.types.js";
import { analyzeHeadroom, applyHeadroomDecisions } from "../convergence/headroom-advisor.js";
import { scanAxisOverlaps, comparePrefixes } from "../convergence/symbol-comparator.js";
import { recordSeparation, applySeparationRecord } from "../convergence/separation-record.js";
import { defineDslBundle, DslBundleRegistry, analyzeDslCoverage, analyzeAllVersionSkew } from "./dsl-bundle.js";

/**
 * 완전한 DKG 그래프를 부트스트랩한다.
 *
 * 1. DEMO_CATALOG에서 Axis/Prefix/composes/references 자동 파생
 * 2. Domain 5개 등록
 * 3. Consumer 2개 등록
 * 4. Constraint 3개 등록
 * 5. DSL Bundle 4개 등록
 * 6. IntentLink 3개 등록
 * 7. Headroom Decision 자동 생성
 * 8. 알려진 분리 유지 기록 (initiator ↔ channel 등)
 * 9. DSL 버전 스큐 분석 → Observation 자동 생성 (재귀 개선 플로우)
 */
export function bootstrapDkg(options?: { date?: string }): GraphRegistry {
  const date = options?.date ?? "2026-03-20";
  const graph = deriveFromCatalog(DEMO_CATALOG);

  // ── Domain 등록 ──────────────────────────────────────
  const domains: DomainNode[] = [
    {
      kind: "domain", id: "shopping-domain", name: "쇼핑 서비스 도메인",
      prefixes: ["permission", "event", "service"],
      sharedAxes: ["env", "region", "svc_name", "namespace"],
      boundary: { exports: ["permission", "event"], internal: ["service"] },
      rationale: "권한과 이벤트가 동일한 서비스 컨텍스트를 공유하는 도메인",
    },
    {
      kind: "domain", id: "tracking-domain", name: "행동 추적 도메인",
      prefixes: ["tracking", "content"],
      sharedAxes: ["channel", "locale"],
      boundary: { exports: ["tracking"], internal: ["content"] },
      rationale: "사용자 행동과 콘텐츠가 같은 채널/로케일 컨텍스트를 공유",
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
      prefixes: ["page_view", "endpoint", "flow_point", "tracking", "pipeline_point", "data_policy", "engine_event", "schema_event"],
      sharedAxes: [],
      boundary: { exports: ["page_view", "endpoint", "flow_point", "pipeline_point", "data_policy", "engine_event", "schema_event"], internal: [] },
      rationale: "비즈니스 로직 + 파이프라인 + 엔진/스키마 관측 포인트 DSL 그룹.",
    },
    {
      kind: "domain", id: "infra-domain", name: "인프라 도메인",
      prefixes: ["deploy_event", "health_event"],
      sharedAxes: ["deploy_action", "health_status"],
      boundary: { exports: ["deploy_event", "health_event"], internal: [] },
      rationale: "인프라 계측 이벤트. 배포/헬스 관측. 전 환경(dev/stage/prod) 대상.",
    },
  ];

  for (const domain of domains) {
    graph.addNode(domain);
    for (const prefixId of domain.prefixes) {
      graph.addEdge("contains", domain.id, prefixId);
    }
  }

  // ── Consumer 등록 ──────────────────────────────────────
  const consumers: ConsumerNode[] = [
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
  ];

  for (const consumer of consumers) {
    graph.addNode(consumer);
    // Consumer → Domain (도메인 단위 소비)
    for (const domain of domains) {
      const overlap = consumer.intendedPrefixes.filter(p => domain.prefixes.includes(p));
      if (overlap.length > 0) {
        graph.addEdge("consumes", consumer.id, domain.id);
      }
    }
  }

  // ── Constraint 등록 ──────────────────────────────────────
  const constraints: ConstraintNode[] = [
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
  ];

  for (const constraint of constraints) {
    graph.addNode(constraint);
    for (const target of constraint.scope) {
      graph.addEdge("constrains", constraint.id, target);
    }
  }

  // ── DslBundle 등록 ──────────────────────────────────────
  const svcFixedDims = ["env", "region", "svc_name", "namespace"];

  const dslBundles: DslBundleNode[] = [
    {
      kind: "dsl-bundle", id: "dsl-observation", name: "관측 DSL",
      description: "화면/API/흐름 관측 포인트를 서비스 단위로 묶는 DSL. 모든 관측 prefix가 동일한 svc_ref를 공유한다.",
      memberPrefixes: ["page_view", "endpoint", "flow_point"],
      serviceBindingPrefix: "service", fixedDims: svcFixedDims,
      invariants: [
        "모든 관측 prefix의 svc_ref는 동일한 service 주소를 참조해야 한다",
        "page_view 없이 flow_point가 관측되면 진입점 누락",
      ],
    },
    {
      kind: "dsl-bundle", id: "dsl-infra", name: "인프라 계측 DSL",
      description: "배포/헬스 이벤트를 서비스 단위로 묶는 DSL. dev/stage/prod 전 환경을 포함한다.",
      memberPrefixes: ["deploy_event", "health_event", "endpoint"],
      serviceBindingPrefix: "service", fixedDims: svcFixedDims,
      invariants: [
        "deploy_event 직후 health_event(degraded)가 발생하면 배포 실패 후보",
        "health_event(unhealthy) 시 해당 서비스의 endpoint 관측을 중단 감지",
      ],
    },
    {
      kind: "dsl-bundle", id: "dsl-checkout", name: "결제 흐름 DSL",
      description: "결제 흐름의 전체 경로를 추적하는 DSL. 화면 진입 → API 호출 → 흐름 분기 → 주문 이벤트 → 권한.",
      memberPrefixes: ["page_view", "endpoint", "flow_point", "order_event", "permission"],
      serviceBindingPrefix: "service", fixedDims: svcFixedDims,
      invariants: [
        "checkout page_view 없이 checkout flow_point(success)가 관측되면 안 됨",
        "order_event(create) 없이 order_event(complete)가 관측되면 안 됨",
      ],
    },
    {
      kind: "dsl-bundle", id: "dsl-auth", name: "인증/권한 DSL",
      description: "인증 이벤트와 권한 관리를 묶는 DSL. auth_event + permission + endpoint.",
      memberPrefixes: ["auth_event", "permission", "endpoint"],
      serviceBindingPrefix: "service", fixedDims: svcFixedDims,
    },
    {
      kind: "dsl-bundle", id: "dsl-commerce", name: "커머스 이벤트 DSL",
      description: "장바구니/주문 이벤트와 이벤트 로그를 묶는 DSL. cart_event + order_event + event.",
      memberPrefixes: ["cart_event", "order_event", "event"],
      serviceBindingPrefix: "service", fixedDims: svcFixedDims,
    },
    {
      kind: "dsl-bundle", id: "dsl-content", name: "콘텐츠/행동 DSL",
      description: "콘텐츠 분류와 사용자 행동 추적을 묶는 DSL. content + tracking.",
      memberPrefixes: ["content", "tracking"],
      serviceBindingPrefix: "service", fixedDims: svcFixedDims,
    },
    {
      kind: "dsl-bundle", id: "dsl-access-control", name: "접근 제어 DSL",
      description: "RBAC 모델과 관계 모델을 묶는 DSL. rbac + relational.",
      memberPrefixes: ["rbac", "relational"],
      serviceBindingPrefix: "service", fixedDims: svcFixedDims,
    },
    {
      kind: "dsl-bundle", id: "dsl-pipeline", name: "파이프라인 관측 DSL",
      description: "수집 파이프라인의 처리 경로와 데이터 정책을 묶는 DSL. 어떤 단계에서 어떤 모드로 어떤 결과가 나왔는가.",
      memberPrefixes: ["pipeline_point", "data_policy", "engine_event", "schema_event", "endpoint"],
      serviceBindingPrefix: "service", fixedDims: svcFixedDims,
      invariants: [
        "pipeline_phase=verdict 이전에 pipeline_phase=reconstruct가 선행되어야 한다",
        "validation_mode=strict에서 verdict_result=unknown이 나오면 안 된다",
        "schema_event(migrate) 후 engine_event의 constraint_op 평가가 새 스키마 기준이어야 한다",
      ],
    },
  ];

  for (const bundle of dslBundles) {
    graph.addNode(bundle);
    for (const prefixId of bundle.memberPrefixes) {
      graph.addEdge("contains", bundle.id, prefixId);
    }
    // DSL → service prefix 바인딩
    graph.addEdge("binds", bundle.id, bundle.serviceBindingPrefix);
  }

  // ── IntentLink 등록 ──────────────────────────────────────
  const intentLinks: IntentLinkNode[] = [
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
  ];

  for (const link of intentLinks) {
    graph.addNode(link);
    for (const endpoint of link.endpoints) {
      graph.addEdge("binds", link.id, endpoint);
    }
  }

  // ── Headroom Decision 자동 생성 ────────────────────────
  const axisData = Object.entries(DEMO_CATALOG.axes).map(([id, axis]) => {
    const versions = Object.keys(axis.versions);
    const latestKey = versions[versions.length - 1] as keyof typeof axis.versions;
    const latest = axis.versions[latestKey];
    const entries = (latest as any).entries?.length ?? 0;
    const capacity = (latest as any).capacity ?? entries;
    return { id, name: axis.name, entries, capacity };
  });

  const headroomReport = analyzeHeadroom(axisData, { date, graph });
  applyHeadroomDecisions(graph, headroomReport);

  // ── 알려진 분리 유지 기록 ────────────────────────────────
  // initiator ↔ channel: 100% 중복이지만 의도적 분리
  const entriesMap = new Map<string, readonly string[]>();
  for (const [id, axis] of Object.entries(DEMO_CATALOG.axes)) {
    const versions = Object.keys(axis.versions);
    const latestKey = versions[versions.length - 1] as keyof typeof axis.versions;
    const latest = axis.versions[latestKey];
    if (latest && "entries" in latest) {
      entriesMap.set(id, [...(latest as any).entries]);
    }
  }

  const overlaps = scanAxisOverlaps(graph, entriesMap);
  for (const overlap of overlaps) {
    if (overlap.recommendation === "merge" && overlap.overlapRatio >= 0.9) {
      const record = recordSeparation(overlap, {
        id: `DEC-SEP-${overlap.a}-${overlap.b}`,
        date,
        rationale: `${overlap.a}(${getUsedBy(graph, overlap.a)})와 ${overlap.b}(${getUsedBy(graph, overlap.b)})는 entries가 동일하지만 다른 도메인 컨텍스트에서 사용된다. 향후 분기 가능성이 있으므로 분리 유지.`,
      });
      applySeparationRecord(graph, record);
    }
    // 알려진 의도적 분리 기록 (review 또는 keep-separate 모두 대상)
    const pairKey = [overlap.a, overlap.b].sort().join(":");
    if (pairKey === "migration_pattern:verdict_result") {
      const dec: DecisionNode = {
        kind: "decision", id: "DEC-SEP-verdict-migration", date,
        title: "verdict_result와 migration_pattern의 'unknown' 공유 수용",
        context: `두 축이 '${overlap.sharedEntries.join(",")}' entry를 공유 (${(overlap.overlapRatio * 100).toFixed(0)}%)`,
        rationale: "'unknown'은 범용 예약어로 두 축에서 독립적으로 사용됨. verdict의 unknown은 '판정 불가', migration의 unknown은 '패턴 미식별'. 의미가 다르므로 분리 유지.",
        lifecycle: "active",
      };
      graph.addNode(dec);
      graph.addEdge("justifies", dec.id, "verdict_result");
      graph.addEdge("justifies", dec.id, "migration_pattern");
    }
  }

  // ── Prefix 구조 유사도 review → 분리 유지 Decision ────────
  const prefixIds = Object.keys(DEMO_CATALOG.prefixes);
  const reviewPairs = [
    { a: "tracking", b: "page_view", reason: "tracking은 행동 분석(trackAction), page_view는 서비스별 화면 관측(svc_ref). 목적과 서비스 바인딩이 다름." },
  ];

  for (const pair of reviewPairs) {
    if (prefixIds.includes(pair.a) && prefixIds.includes(pair.b)) {
      const sim = comparePrefixes(graph, pair.a, pair.b);
      if (sim.recommendation === "review") {
        const dec: DecisionNode = {
          kind: "decision", id: `DEC-SEP-${pair.a}-${pair.b}`, date,
          title: `${pair.a}과 ${pair.b} 분리 유지`,
          context: `구조 유사도 ${(sim.structuralSimilarity * 100).toFixed(0)}%: ${sim.sharedAxes.join(",")} 축 공유`,
          rationale: pair.reason,
          lifecycle: "active",
        };
        graph.addNode(dec);
        graph.addEdge("justifies", dec.id, pair.a);
        graph.addEdge("justifies", dec.id, pair.b);
      }
    }
  }

  // ── DSL 버전 스큐 분석 → Observation + Decision 자동 생성 ──
  const dslRegistry = new DslBundleRegistry();
  for (const bundle of dslBundles) {
    dslRegistry.register(
      defineDslBundle(DEMO_CATALOG, {
        id: bundle.id,
        name: bundle.name,
        description: bundle.description,
        serviceBinding: { prefixId: bundle.serviceBindingPrefix, fixedDims: [...bundle.fixedDims] },
        members: bundle.memberPrefixes.map(p => ({ prefixId: p, role: "observation" as const })),
      }),
    );
  }

  const skewReports = analyzeAllVersionSkew(DEMO_CATALOG, dslRegistry);
  for (const report of skewReports) {
    if (report.severity === "ok") continue;

    // Observation 생성
    const obs: ObservationNode = {
      kind: "observation",
      id: `OBS-SKEW-${report.bundleId}`,
      date,
      source: "metric",
      subjects: [report.bundleId, ...report.members.map(m => m.prefixId)],
      finding: report.summary,
      suggestion: report.axisConflicts.length > 0
        ? { kind: "revise-decision", decisionId: report.bundleId, reason: `축 버전 충돌 ${report.axisConflicts.length}건: ${report.axisConflicts.map(c => c.axisId).join(", ")}` }
        : undefined,
    };
    graph.addNode(obs);
    graph.addEdge("observes", obs.id, report.bundleId);
    for (const member of report.members) {
      graph.addEdge("observes", obs.id, member.prefixId);
    }

    // Decision 자동 생성 — Observation → Decision 연결
    const slowMembers = report.members.filter(m => m.versionCount === 1).map(m => m.prefixId);
    const fastMembers = report.members.filter(m => m.versionCount > 1).map(m => `${m.prefixId}(${m.versionCount}v)`);
    // 격차가 minor(spread < 4)이면 수용, major이면 active
    const isMinor = report.severity === "minor";
    const dec: DecisionNode = {
      kind: "decision",
      id: `DEC-SKEW-${report.bundleId}`,
      date,
      title: `${report.bundleId} 버전 ${isMinor ? "격차 수용" : "정렬 필요"}`,
      context: report.summary,
      rationale: isMinor
        ? `${fastMembers.join(",")}이 빠르게 진화했지만, 느린 멤버(${slowMembers.join(",")})는 아직 변경 사유 없음. 현재 격차(${report.maxVersionSpread})는 호환 범위 내이므로 수용. 느린 멤버에 변경 사유 발생 시 자연스럽게 해소.`
        : `${fastMembers.join(",")}이 빠르게 진화한 반면 ${slowMembers.join(",")}은 v1 유지. 동일 DSL 내 버전 격차 ${report.maxVersionSpread}. 멤버 간 호환성 검증 필요.`,
      alternatives: [
        `느린 멤버(${slowMembers.join(",")})에 v2 생성하여 격차 해소`,
        "DSL 번들에서 버전 핀 명시 (minVersion 제약)",
        "현재 상태 유지 — 격차를 수용하고 호환성만 확인",
      ],
      reversalConditions: isMinor
        ? [`격차가 4 이상으로 확대되면 재검토`]
        : undefined,
      lifecycle: isMinor ? "active" : "active",
    };
    graph.addNode(dec);
    graph.addEdge("prompts", obs.id, dec.id);  // Observation → Decision
    graph.addEdge("justifies", dec.id, report.bundleId);
    for (const prefixId of slowMembers) {
      graph.addEdge("governs", dec.id, prefixId);
    }
  }

  // DSL 커버리지 분석 → uncovered prefix Observation
  const dslCoverage = analyzeDslCoverage(DEMO_CATALOG, dslRegistry);
  if (dslCoverage.uncovered.length > 0) {
    const obs: ObservationNode = {
      kind: "observation",
      id: "OBS-DSL-UNCOVERED",
      date,
      source: "metric",
      subjects: dslCoverage.uncovered as string[],
      finding: `DSL에 포함되지 않은 prefix ${dslCoverage.uncovered.length}개: ${dslCoverage.uncovered.join(", ")}`,
      suggestion: { kind: "add-constraint", rule: "모든 관측/이벤트 prefix는 DSL 번들에 포함되어야 한다" },
    };
    graph.addNode(obs);
    for (const prefixId of dslCoverage.uncovered) {
      if (graph.getNode(prefixId)) {
        graph.addEdge("observes", obs.id, prefixId);
      }
    }
  }

  // ── Spec 노드 등록 (핵심 스펙 문서) ───────────────────
  const specs: SpecNode[] = [
    { kind: "spec", id: "SPEC-IDENTITY", type: "req", title: "차원 압축 기반 DSL DB 정체성", lifecycle: "active" },
    { kind: "spec", id: "SPEC-5Q", type: "adr", title: "축 선택 5Q Checklist", lifecycle: "active" },
    { kind: "spec", id: "SPEC-AXIS-BOUNDARY", type: "adr", title: "축에 넣을 것과 넣지 않을 것", lifecycle: "active" },
    { kind: "spec", id: "SPEC-CATEGORY-RULES", type: "ls", title: "카테고리별 prefix 타입 규칙 (6종)", lifecycle: "active" },
    { kind: "spec", id: "SPEC-DECISION-STD", type: "feat", title: "의사결정 표준 프로세스 7Q", lifecycle: "active" },
    { kind: "spec", id: "SPEC-PROPAGATION", type: "feat", title: "스펙 전파 파이프라인 (publish→seal→activate)", lifecycle: "active" },
    { kind: "spec", id: "SPEC-TEMPORAL", type: "req", title: "시간 순서와 데이터 흐름 수집", lifecycle: "draft" },
  ];
  for (const spec of specs) {
    graph.addNode(spec);
  }
  // governs 엣지: spec → prefix/axis 연결
  graph.addEdge("governs", "SPEC-CATEGORY-RULES", "permission");
  graph.addEdge("governs", "SPEC-CATEGORY-RULES", "rbac");
  graph.addEdge("governs", "SPEC-AXIS-BOUNDARY", "endpoint");
  graph.addEdge("governs", "SPEC-PROPAGATION", "service");

  return graph;
}

function getUsedBy(graph: GraphRegistry, axisId: string): string {
  const prefixes = graph.reverseNeighbors(axisId, "composes");
  return prefixes.join(",") || "미사용";
}
