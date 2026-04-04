---
address: 9001
def:
  id: harness-model-spec
  level: leaf
  scope: state
  aspect: system_state
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [testing, quality-harness]
  links:
    - target: harness-state-model
      type: refines
    - target: harness-architecture
      type: depends_on
tests:
  - kind: unit
    intent: deriveHarnessState 4단계 상태 판별
    module: work-domain/harness-model
  - kind: e2e
    intent: concept-defined → verified 전이 검증
    module: work-domain/harness-model
    scope: single
---


## 탐색 ^navigation

quality-gates-system > **harness-model-spec**

형제: `gate-kind-taxonomy` · `gate-tracker-spec` · `harness-state-model` · `work-domain-quality-bundle` · `definition-quality-gates` · `decision-flow-quality-bundle` · `ingest-quality-bundle` · `query-quality-bundle` · `definition-service-quality-bundle` · `decode-quality-bundle` · `registry-quality-bundle` · `quality-ledger` · `dkg-harness-bridge`

## 목적 ^purpose

품질 게이트/계약/번들을 "문서 종류"가 아니라 **"현재 어디까지 도달했는가"**로 읽기 위한 4단계 구조적 상태 모델. 런타임 GateState(9상태)와 구분되는 상위 개념.

## 사용 맥락 ^context

`deriveHarnessState(docs)` 함수에 번들 내부 문서 목록을 전달하면, 각 문서를 역할(concept/contract/gate/support)로 분류하고 현재 도달 상태를 반환한다.

## 4단계 상태

```
concept-defined → contract-bound → gate-bound → verified
```

| 상태 | 조건 | 의미 |
|------|------|------|
| concept-defined | 개념 번들 문서 존재 | 관리 단위가 식별됨 |
| contract-bound | + interface 계약 문서 존재 | 입출력 약속이 고정됨 |
| gate-bound | + constraint/validation gate 문서 존재 | 검증 단위가 연결됨 |
| verified | + 게이트 실행 증거 확보 | 하네스가 닫힘 |

## 문서 역할 분류 (classifyHarnessDocRole)

| 역할 | 판별 기준 |
|------|----------|
| concept | `quality-bundle` 태그 또는 flow/overview |
| contract | scope === "interface" |
| gate | `gate` 블록 있음 또는 constraint/validation |
| support | 위 어디에도 해당 안 함 |

## 런타임 상태와의 관계

| 계층 | 질문 | 상태 모델 |
|------|------|----------|
| **구조적** (이 문서) | "문서가 충분한가" | concept-defined → verified |
| **런타임** | "게이트가 통과했는가" | GateState 9상태 + BundleState 6상태 |

구조적 `verified` = 런타임 `BundleState === "complete"`. Cross-Loop 브릿지가 두 계층을 연결.

## 관련 소스

- `work-domain/src/harness-model.ts` — 4단계 + 문서 역할 분류
- `work-domain/src/harness-model.test.ts` — 2건
