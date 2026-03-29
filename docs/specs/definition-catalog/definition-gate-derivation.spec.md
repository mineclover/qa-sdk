---
def:
  id: definition-gate-derivation
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: []
  links:
    - target: definition-quality-gates
      type: refines
    - target: definition-taxonomy
      type: depends_on
---
# Gate Derivation — GateKind 자동 도출

## 목적 ^purpose

계약 문서(interface, constraint scope)에서 필요한 GateKind를 자동 도출한다. scope×aspect 매핑 규칙과 concern 태그 추가를 정의. definition-service API에서 gate 자동 발견에도 재사용.

## 정의 ^defines

- isContractDoc() — 계약 문서 판별 (interface/constraint)
- deriveGateKinds() — scope×aspect → GateKind 매핑
- GATE_KIND_SCOPE_MAP — GateKindId→GateScope 역매핑
- 구조적 상태 4종 (concept-defined→contract-bound→gate-bound→verified)

## 소비 ^consumes

- GateKindId, GateScope (gate-kind.ts) — 게이트 유형 택소노미
- scope, aspect (taxonomy) — 문서 분류 축
- concern tags (taxonomy) — security/accessibility/performance 추가 도출

## 문서 역할 분류

| 역할 | 문서 유형 | 기능 |
|------|----------|------|
| **개념 보조** | feature, flow, state, data | anchor의 의미를 구성 |
| **계약 선언** | interface, constraint | 품질 게이트의 근거 |

`isContractDoc(scope)` — interface 또는 constraint이면 계약 문서.

## scope × aspect → GateKind 매핑 ^constraint

| 계약 문서 유형 | 도출 GateKind |
|--------------|--------------|
| interface/api_contract | typecheck, api-contract |
| interface/cli_contract | typecheck, integration-test |
| interface/event_contract | typecheck, unit-test |
| constraint/tech_constraint | unit-test, static-analysis |
| constraint/biz_constraint | integration-test |
| constraint/infra_constraint | build, integration-test |

## concern 태그 추가

| concern tag | 추가 GateKind |
|-------------|--------------|
| security | security-audit |
| accessibility | a11y-check |
| performance | perf-benchmark |

## 구조적 상태 도출

| 조건 | 파생 상태 |
|------|----------|
| concept 문서만 있음 | `concept-defined` |
| + contract 문서 있음 | `contract-bound` |
| + gate 문서 있음 | `gate-bound` |
| + 모든 gate passed | `verified` |

## 관련 소스

- `work-domain/src/contract-to-gates.ts` — isContractDoc, deriveGateKinds, GATE_KIND_SCOPE_MAP
- `work-domain/src/gate-kind.ts` — 19종 GateKind 택소노미
- `work-domain/src/harness-model.ts` — deriveHarnessState, classifyHarnessDocRole
