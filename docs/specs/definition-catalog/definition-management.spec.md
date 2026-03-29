---
def:
  id: definition-management
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural, entry-point]
  links:
    - target: definition-taxonomy
      type: depends_on
    - target: definition-level
      type: depends_on
    - target: definition-concern
      type: depends_on
    - target: definition-assembly
      type: depends_on
    - target: harness-architecture
      type: depends_on
---

## 목적 ^purpose

문서, 코드, 테스트, 관측을 **하나의 좌표 체계**로 관통 관리하는 시스템의 단일 참조점. 모든 정의 단위(문서/코드/게이트/관측)가 동일한 좌표 주소를 공유하여, "이 문서의 코드는 어디인가", "이 코드의 테스트는 통과했는가", "이 관측은 어떤 문서에 피드백되는가"를 좌표로 추적한다.

## 구성 ^overview

### 시스템 목표

```
정의(문서) ←→ 구현(코드) ←→ 검증(테스트/게이트) ←→ 관측(이벤트/메트릭)
    │              │              │                    │
    └──────────────┴──────────────┴────────────────────┘
                    동일한 좌표 체계로 연결
```

모든 것이 좌표로 식별된다:
- **문서**: `def_document:v2:<address>` (scope × aspect × depth × seq)
- **링크**: `def_link:v1:<address>` (scope × aspect × link_type)
- **코드 상태**: `harness_transition:v1:<address>` (machine × state × trigger)
- **게이트 결과**: `gate_execution:v1:<address>` (kind × scope × state)
- **관측 이벤트**: 51개 event→prefix 매핑으로 자동 좌표화

### 두 축의 분리

문서는 **역할(level)**과 **주제(scope)** 두 독립 축으로 분류된다.

| 축 | 질문 | 값 | 좌표 인코딩 |
|----|------|-----|-----------|
| **level** (역할) | "이 문서가 하는 일" | group / module / leaf | ✗ 메타데이터 |
| **scope** (주제) | "이 문서가 다루는 대상" | 7종 (ui ~ interface) | ✓ 주소 dim 1 |

직교 원칙: module(개념 정의)의 자식 leaf들이 서로 다른 scope를 가지는 것이 정상이다. 하나의 개념을 여러 관점으로 분해한 것이기 때문이다.

---

## 1단계. 좌표 부여 — "이 정의는 어디에 놓이는가"

### Layer — "왜 존재하는가"

| layer | 판별 | 영향 전파 |
|-------|------|----------|
| **domain** | "없으면 거짓" | → operation, mediation |
| **operation** | "없으면 느려짐" | → 자기 내부만 |
| **mediation** | "없으면 불편" | → experience |
| **experience** | "없으면 유도 소멸" | → 자기 내부만 |

### DocType — "이 문서는 무엇을 기록하는가"

| type | 질문 | 기록하는 것 |
|------|------|-----------|
| **spec** (기본) | "시스템이 무엇으로 구성되어 있는가" | 코드에서 파생 가능한 사실 |
| **knowledge** | "왜 이렇게 설계했는가" | 사람만이 기록할 수 있는 판단 근거 |

knowledge 문서는 `knowledge_kind`로 세분화:

| kind | 기록 | 예시 |
|------|------|------|
| philosophy | 시스템 철학/본질 | "왜 좌표계인가" |
| adr | 아키텍처 결정 | "ADR-001: 불변 주소" |
| guide | 판단 기준/사용법 | "scope 선택 가이드" |
| narrative | 진화 과정/맥락 | "시스템이 여기까지 온 경로" |
| convention | 합의된 규칙 | "에러 코드 컨벤션" |
| pattern | 반복 설계 패턴 | "이벤트 수집 패턴" |

spec과 knowledge 모두 **동일한 좌표 체계**(scope/aspect/depth/level/layer)를 사용한다. 차이는 "코드에서 검증 가능한가"뿐.

### Level — "이 문서의 역할"

**원칙: 모든 문서는 하나의 개념과 그 개념의 구성을 참조하는 완결된 정의여야 한다.**

| level | 질문 | 정의하는 것 | contains |
|-------|------|-----------|----------|
| **group** | "왜 함께 있는가" | 묶임의 이유 | → group \| module |
| **module** | "이 개념은 무엇인가" | 단일 개념 + 구성 참조 | → module \| leaf |
| **leaf** | "어떻게 동작하는가" | 최종 명세 | → (없음) |

### Scope × Aspect — "무엇에 대한, 어떤 측면"

scope가 주소 dim 1, aspect가 dim 2. 유효 조합만 허용된다 (taxonomy.ts `VALID_SCOPE_ASPECTS`).

| scope | 유효 aspect |
|-------|------------|
| ui | layout, component, interaction |
| feature | func_def, scenario |
| flow | user_scenario, process_flow, relation |
| state | app_state, domain_state, system_state |
| constraint | tech_constraint, biz_constraint, infra_constraint |
| data | domain_data, system_data, external_data, prefix_schema, axis_catalog |
| interface | api_contract, cli_contract, event_contract |

### Depth — "얼마나 구체적인가"

주소 dim 3. 문서의 구체성 수준.

| depth | 용도 | 필수 마커 |
|-------|------|----------|
| overview | 전체 조감도 | `^overview` |
| specification | 상세 명세 | `^purpose` |
| implementation | 구현 상세 | 코드 블록 |
| validation | 검증 명세 | 게이트 정의 |

### Tags — "횡단 관심사"

- **Concern (7종, BFS 전파)**: security, performance, accessibility, observability, testing, migration, deprecation
- **Structural (4종, 비전파)**: cross-scope, entry-point, decision, generated

---

## 2단계. 그래프 연결 — "정의들이 어떻게 교류하는가"

### 세로 구조 (level 계층)

contains 링크가 역할 계층을 구성한다:

```
system-root (group)
  └── system-infra (group)
       └── ingest-system (module, scope: flow)
            ├── ingest-api (leaf, scope: interface)
            ├── ingest-data (leaf, scope: data)
            └── ingest-constraint (leaf, scope: constraint)
```

### 가로 교류 (scope 간 연결)

depends_on, implements, refines, constrains 링크가 관점 간 관계를 표현한다:

```
leaf(interface) ──depends_on──→ leaf(data)          "API가 이 스키마에 의존"
leaf(feature)   ──implements──→ leaf(interface)      "이 코드가 이 API를 구현"
leaf(constraint)──constrains──→ module(feature)      "이 규칙이 이 기능을 제약"
leaf(flow)      ──refines────→ leaf(flow)           "이 시나리오가 저것을 상세화"
```

### 그래프 관측

구조 변경은 `graph_event` prefix로 좌표화:

```
graph_event: svc_ref × def_level × graph_action × link_type
```

graph_action: link_add, link_remove, promote, demote, split, merge

---

## 3단계. 상태 추적 — "이 정의의 현재 상태는 무엇인가"

### 11개 상태 머신 (harness)

| 머신 | 추적 대상 | prefix |
|------|----------|--------|
| doc-lifecycle | draft → review → approved | harness_transition |
| spec-impl | designed → implementing → verified | harness_transition |
| convention-compliance | unverified → compliant | harness_transition |
| db-sync | out-of-sync → synced | harness_transition |
| address-state | open → active → inactive | harness_transition |
| version-lifecycle | draft → released → active | harness_transition |
| + 5개 시스템 머신 | service, event, metric, flow, policy | harness_transition |

### 품질 게이트 (gate-tracker)

| 관측 | prefix | 추적 |
|------|--------|------|
| 게이트 전이 | gate_execution | kind × scope × state |
| 번들 완성도 | bundle_observation | bundle_state |
| guard 검증 | harness_guard | machine × state × verdict |

---

## 4단계. 관측 피드백 — "관측이 다시 정의를 개선한다"

### 6개 피드백 루프

```
① 사용자 행동 → ④ 수렴 분석 → ⑥ 인프라 관측
      ↑                                ↓
② 상태 머신 ← ③ 품질 게이트 ← ⑤ 의사결정
```

| 연결 | 브릿지 | 좌표 |
|------|--------|------|
| ③→② Gate→Harness | `createGateHarnessBridge()` | bundle complete → convention compliant |
| ②→⑤ Harness→Decision | `buildHarnessContext()` | 머신 상태 → 의사결정 컨텍스트 |
| ⑤→⑥ Decision→Infra | `createDecisionInfraBridge()` | verdict → doc lifecycle 전이 |
| 리뷰→⑤ Feedback→Decision | `FeedbackRequest` + `review bridge-request` | evidence bundle → DKG observation/prompts |
| ⑥→① Infra→User | `gateFilterRanges("encodable")` | gate 상태 → encode 차단 |
| ①→④ 자동 | HTTP ingest → convergence pipeline | 레코드 → 패턴/메트릭 |
| ④→⑥ 자동 | `metricsToObservations()` | 메트릭 → 관측 노드 |

### 관측 좌표 커버리지

```
전체 prefix: 63개
관측 prefix: 33개 — 전부 이벤트 매핑 완결 (52건)
카테고리: navigation(7), interaction(10), form(5), session(6), network(8),
          execution(16), outcome(7), quality(8), infrastructure(15)
```

---

## 일관성 규칙

### 좌표 주소는 불변

scope × aspect × depth가 주소를 결정한다. 한번 부여된 주소는 변하지 않는다. level, lifecycle, tags는 변할 수 있으므로 주소에 포함하지 않는다.

### 모든 정의는 하나의 개념

문서든 코드 단위든 하나의 개념과 그 구성을 참조하는 완결된 정의여야 한다. 여러 개념이 섞이면 분할한다.

### 모든 상태 변경은 좌표화

하네스 전이, 게이트 실행, 그래프 변경, 수렴 분석 — 모두 prefix 좌표가 있어서 "언제 어디서 무엇이 변했는가"를 추적할 수 있다.

### 피드백은 순환

관측 → 분석 → 의사결정 → 문서 갱신 → 코드 변경 → 관측. 어느 지점에서 시작해도 순환이 끊어지지 않는다.

---

## 사용 맥락 ^context

| 상황 | 사용하는 것 |
|------|-----------|
| 새 문서 생성 | `/def-new` → 이 문서의 1단계 (좌표 부여) |
| 문서 분류/이동 | `/def-level`, `/def-link` → 2단계 (그래프 연결) |
| 상태 조회/전이 | `/def-state` → 3단계 (상태 추적) |
| 품질 검증 | `qa-sdk quality` → 3단계 (게이트 실행) |
| 문서 감사 | `/def-audit` → 1~3단계 전체 정합성 |
| 시스템 탐색 | `/def-explore`, `/def-topdown` → 그래프 탐색 |
| 피드백 추적 | `def get/context/impact/bottomup` → 최근 `FeedbackRequest`와 synthetic feedback trace 조회 |

## 주의사항 ^caveat

- 이 문서는 150줄 기준을 초과하지만, 4단계 전체를 관통하는 참조점이므로 의도적으로 단일 문서로 유지
- scope/aspect 선택은 "가장 적합한 좌표"를 찾는 것. 애매하면 depends_on 링크가 더 자연스러운 좌표를 선택
- guard 순서: Decision success → Doc approved → Gate complete → Convention compliant

## 관련 문서

| 문서 | 역할 |
|------|------|
| `definition-system-philosophy.md` | 좌표 기반 문서화 철학 — "왜 좌표인가" |
| `scope-classification-guide.md` | scope 7종 판별 트리 |
| `definition-taxonomy.spec.md` | scope × aspect 유효 조합 |
| `definition-level.spec.md` | level 3종 + scope와의 직교 |
| `definition-concern.spec.md` | concern 전파 규칙 |
| `definition-assembly.spec.md` | contains 멤버 조립 |
| `harness-architecture.spec.md` | 하네스 2계층 + Cross-Loop |
| `tag-management.spec.md` | 태깅 저장/전파 전략 |
