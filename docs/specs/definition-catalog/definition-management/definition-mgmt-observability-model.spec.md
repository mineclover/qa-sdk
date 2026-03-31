---
def:
  id: definition-mgmt-observability-model
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [observability, decision]
  links:
    - target: definition-management
      type: refines
    - target: definition-mgmt-feedback-loop
      type: depends_on
    - target: definition-mgmt-state-tracking
      type: depends_on
    - target: definition-mgmt-verification-loop
      type: depends_on
    - target: harness-architecture
      type: depends_on
---

# Definition Management — Observability Model

## 목적 ^purpose

definition 관리에서 무엇을 관찰하고 어떤 좌표로 남길지의 기본 틀을 고정한다. Definition/State/Decision/Verification 네 평면과 reachable path registry를 먼저 정의하여, 이후 대시보드나 prefix 추가가 의미 계층을 깨지 않도록 한다.

## 구성 ^overview

- 4개 핵심 평면: Definition, State, Decision, Verification
- N개 파생 판: Timeline, Drift, Coverage, Hotspot 등
- reachable path registry: 전체 조합이 아니라 실제 도달 가능한 경로만 sparse하게 등록
- family-local path id: family별 경로 언어를 별도로 관리
- path lifecycle FSM: candidate → observed → stable → retired / invalid

## 4개 핵심 평면

| 평면 | 질문 | 주 데이터 |
|------|------|----------|
| Definition Plane | 무엇이 정의돼 있고 어떻게 연결되는가 | doc graph, links, code_references |
| State Plane | 지금 어떤 상태인가 | doc-lifecycle, spec-impl, convention, db-sync, harness |
| Decision Plane | 왜 이런 구조/상태가 되었는가 | decision_event, decision_path, model_apply, forcing_response, dkg_decision_event |
| Verification Plane | 지금 믿어도 되는가 | validate, quality_event, gate_execution, bundle_observation, test_event |

모든 추가 시각화는 새 의미 계층이 아니라 위 4개 평면의 projection이어야 한다.

## 제어 루프 심볼

```text
G = Definition Graph
X = State Vector
D = Decision Trace
V = Verification Trace
O = Observation Ledger

r = target state
u = control action
e = error vector
y = observed projection
```

| 심볼 | 의미 |
|------|------|
| `G` | 문서/코드 연결 정의 그래프 |
| `X` | 현재 상태 벡터 (`x_doc`, `x_sync`, `x_conv`, `x_gate`, `x_dec`) |
| `D` | 의사결정 인과 추적 |
| `V` | 검증 및 gate 추적 |
| `r` | 목표 상태 (`approved + synced + compliant + complete`) |
| `u` | edit/sync/validate/gate/decide 같은 제어 입력 |
| `e` | drift, failed gate, broken link, broken code reference 같은 오차 |
| `y` | prefix bundle + payload로 표현한 관측 결과 |

## Reachable Path 원칙 ^intent

전체 변수의 전곱을 좌표화하지 않는다. 좌표화 대상은 개별 이벤트 family에서 **실제로 도달 가능한 경로의 언어**다.

```text
Axis Space A_e
  = family e가 사용할 수 있는 개별 branch/choice 집합

Reachable Path Space R_e
  = A_e 위에서 실제로 도달 가능한 path signature의 집합

Registry ρ_e
  = R_e의 각 path에 sparse path id를 부여하는 매핑
```

즉 `path_id`는 전체 곱공간의 주소가 아니라 `family_id`별 reachable path registry의 로컬 식별자다.

## Reachable Path Record

```ts
type PathSource = "observed" | "inferred" | "spec-derived";
type PathStatus = "candidate" | "observed" | "stable" | "retired" | "invalid";

interface BranchPointRef {
  family_id: string;
  branch_point_id: string;
  choice_id: string;
  seq: number;
}

interface ReachablePathRecord {
  family_id: string;
  path_id: string;          // 예: def.authoring:p17
  signature_hash: string;
  signature: BranchPointRef[];

  status: PathStatus;
  source: PathSource;

  first_seen_at?: string;
  last_seen_at?: string;
  hit_count: number;

  anchor_id?: string;
  doc_id?: string;
  service?: string;
  code_path?: string;

  evidence_refs: string[];
  tags: string[];
}
```

unique key:

```text
UNIQUE(family_id, signature_hash)
UNIQUE(path_id)
```

## Path Lifecycle FSM

```text
candidate -> observed -> stable -> retired
candidate -> invalid
observed  -> invalid
stable    -> invalid
```

| 상태 | 의미 |
|------|------|
| `candidate` | spec이나 추론으로는 가능하지만 아직 실관측 없음 |
| `observed` | 실제 이벤트에서 1회 이상 관측 |
| `stable` | 반복 관측되어 canonical path로 간주 가능 |
| `retired` | 예전엔 유효했지만 이제는 더 이상 나오면 안 됨 |
| `invalid` | guard 위반 또는 구조적으로 허용되지 않는 경로 |

전이 조건:

- `candidate -> observed`: 첫 실관측 발생
- `observed -> stable`: 반복 관측 + 최근 윈도우에서 유지
- `observed/stable -> retired`: migration 완료 또는 legacy 종료
- `candidate/observed/stable -> invalid`: forbidden transition, broken dependency, retired path 재발생

## Family 구분

`family_id`는 prefix가 아니라 **경로를 수집하는 오토마톤 단위**다.

초기 family:

- `def.authoring`
- `def.validation`
- `def.boundary-decision`

향후 필요 시:

- `def.mapping`
- `def.verification-loop`
- `decision.<flow-schema-id>`

## Family 1 — `def.authoring`

문서 작성과 코드 매핑이 승인 가능한 상태로 수렴하는 경로를 수집한다.

### branch point

| branch_point_id | choice_id |
|-----------------|-----------|
| `doc-lifecycle` | `draft`, `review`, `approved`, `deprecated`, `archived` |
| `code-mapping` | `unmapped`, `mapped-doc`, `mapped-boundary`, `ambiguous`, `missing` |
| `db-sync` | `out-of-sync`, `syncing`, `synced`, `drift-detected` |
| `convention` | `unverified`, `partial`, `compliant`, `violated` |
| `approval` | `pending`, `approved`, `rejected`, `blocked` |

### canonical path 예시

```text
draft
  -> mapped-boundary
  -> synced
  -> compliant
  -> approved
```

payload 권장 필드:

- `anchor_id`
- `doc_id`
- `source_path`
- `code_path`
- `mapping_count`
- `missing_markers`

## Family 2 — `def.validation`

sync/validate/audit/gate/test 루프를 하나의 verification 경로로 수집한다.

### branch point

| branch_point_id | choice_id |
|-----------------|-----------|
| `sync-result` | `synced`, `partial`, `failed`, `skipped` |
| `validate-result` | `passed`, `warning`, `failed` |
| `audit-result` | `clean`, `issue-found`, `failed` |
| `gate-result` | `idle`, `running`, `passed`, `failed`, `stale`, `skipped` |
| `bundle-state` | `empty`, `pending`, `partial`, `complete`, `degraded` |
| `test-result` | `passed`, `failed`, `skipped` |

### canonical path 예시

```text
synced
  -> passed
  -> clean
  -> passed
  -> complete
  -> passed
```

payload 권장 필드:

- `command`
- `errors`
- `warnings`
- `issue_types`
- `gate_kind`
- `bundle_state`
- `suite`
- `duration_ms`

## Family 3 — `def.boundary-decision`

boundary split, parent 재지정, link topology 변경 같이 taste/architecture 성격의 결정 경로를 수집한다.

### branch point

| branch_point_id | choice_id |
|-----------------|-----------|
| `observation` | `detected`, `reviewed`, `escalated` |
| `framing` | `single-boundary`, `multi-boundary`, `migration`, `rollback` |
| `decision` | `split`, `merge`, `move`, `deprecate`, `hold` |
| `application` | `planned`, `applied`, `partial`, `reverted` |
| `stabilization` | `validated`, `drift`, `failed`, `stable` |

### canonical path 예시

```text
detected
  -> migration
  -> move
  -> applied
  -> validated
  -> stable
```

payload 권장 필드:

- `anchor_id`
- `old_parent`
- `new_parent`
- `changed_links`
- `decision_id`
- `rationale`
- `affected_docs`

## Prefix Bundle 규칙 ^context

각 family는 prefix를 모두 다 쓰지 않는다. 관찰 의미를 최소 묶음으로 제한한다.

| family | 기본 prefix bundle |
|--------|--------------------|
| `def.authoring` | `service`, `cli_tracking`, `spec_event`, `observation_event` |
| `def.validation` | `service`, `cli_tracking`, `quality_event`, `gate_execution`, `bundle_observation`, `test_event`, `test_coverage` |
| `def.boundary-decision` | `decision_event`, `decision_path`, `model_apply`, `forcing_response`, `dkg_observation_event`, `dkg_decision_event`, `edge_activity` |

원칙:

- prefix는 집계/투영용 의미만 가진다.
- `doc_id`, `anchor_id`, `code_path`, `command`, `issues`는 payload에 둔다.
- 새 시각화 판은 새 prefix를 만들기보다 family와 payload projection으로 우선 해결한다.

## 파생 판 규칙 ^constraint

- 새 판은 허용하되 새 의미 평면은 금지한다.
- 모든 판은 Definition/State/Decision/Verification의 projection이어야 한다.
- Path View는 독립 평면이 아니라 reachable path registry를 기준으로 4개 평면을 재조합한 파생 판이다.
- family를 새로 만들 때는 먼저 branch point와 canonical path를 정의한 뒤 prefix를 붙인다.

## 관련 문서

- `definition-mgmt-feedback-loop`
- `definition-mgmt-state-tracking`
- `definition-mgmt-verification-loop`
- `harness-architecture`
