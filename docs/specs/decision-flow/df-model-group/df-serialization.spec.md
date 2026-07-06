---
def:
  tier: component
  id: df-serialization
  address: def_document:v2:412809
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: decision-flow
  tags: [decision]
  links:
    - target: df-observation-space
      type: depends_on
sources:
  - packages/decision-flow/src/types.ts
  - packages/decision-flow/src/schema.ts
  - packages/decision-flow/src/vocabulary.ts
  - packages/decision-flow/src/catalog.ts
  - packages/decision-flow/src/coordinate.ts
  - packages/decision-flow/src/observe.ts
  - packages/decision-flow/src/decision-flow.test.ts
  - packages/decision-flow/src/observe.test.ts
  - packages/decision-flow/src/proof.test.ts
---
# Decision Flow 직렬화

## 목적 ^purpose

의사결정 좌표의 직렬화 형식. 기존 qa-sdk SemanticAddress와 동일한 `prefix:version:address` 패턴을 사용한다.

## 구성 ^overview

5개 prefix의 직렬화: decision_event:v1:N, decision_path:v1:N, escalation_event:v1:N, model_apply:v1:N, forcing_response:v1:N.

## 직렬화 형식

```
"decision_event:v1:1234"
"decision_path:v1:42"
"model_apply:v1:7"
```

## 역방향 해석

```json
{
  "prefix": "decision_event",
  "version": "v1",
  "address": 1234,
  "decoded": {
    "flow_type": "ceo_review",
    "cognitive_phase": "evaluate",
    "evidence_kind": "data",
    "confidence_band": "high"
  }
}
```
