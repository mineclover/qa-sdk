---
def:
  id: decision-flow-quality-contract
  scope: interface
  aspect: api_contract
  depth: specification
  svc: decision-flow
  lifecycle: approved
  layer: mediation
  tags: [testing, contract, work-domain:productivity]
  links:
    - target: decision-flow-quality-bundle
      type: refines
---
# Decision Flow Public Contract


## 탐색 ^navigation

quality-gates-system > decision-flow-quality-bundle > **decision-flow-quality-contract**

형제: `gate-decision-flow-typecheck` · `gate-decision-flow-build` · `gate-decision-flow-test`

## 목적 ^purpose

`decision-flow` 패키지가 외부 소비자에게 약속하는 FlowSchema/FlowEngine/관측 API surface를 한 문서로 고정하여 quality gate의 기준점을 제공한다.

## 구성 ^overview

핵심 계약은 `FlowSchemaBuilder`, `FlowEngine`, `encodeDecisionEvent()`, `createComparisonReport()`, `MENTAL_MODELS`다.
validation gate 문서는 이 계약이 타입, 빌드 산출물, 테스트 동작 수준에서 유지되는지 검증한다.

## 입력 ^inputs

- 소비자는 `FlowSchema`와 `FlowInstance`를 상태 진입점으로 사용한다.
- 엔진 입력은 schema 등록, context, gate branch 선택, evidence 배열이다.
- 관측 입력은 decision_event / decision_path / model_apply 같은 decision prefix 값이다.

## 출력 ^outputs

- `FlowEngine`는 selection 결과를 coordinate address와 address_context로 완성한다.
- `createComparisonReport()`는 인스턴스/기간 비교 결과를 report로 반환한다.
- `encodeDecisionEvent()` 계열 함수는 decision prefix 주소를 만든다.

## 사전 조건 ^precondition

- schema는 gate/branch 제약을 만족해야 하고 registerSchema() 전에 validate 가능해야 한다.
- decision-flow package의 export surface는 build 후에도 ESM/CJS/DTS에서 일관돼야 한다.
- quality bundle은 이 계약 문서를 기준으로 typecheck/build/test 게이트를 실행한다.

## 사후 조건 ^postcondition

- typecheck gate는 공개 타입과 export surface가 깨지지 않았음을 보장한다.
- build gate는 배포 가능한 dist 산출물이 생성됨을 보장한다.
- test gate는 engine/observe/comparison/policy-learning 핵심 동작이 유지됨을 보장한다.

## 증거 요구 ^evidence

- `qa-sdk quality claims decision-flow-quality-bundle` 결과에 claim이 1건 이상 있어야 한다. [reversible]
- `gate-decision-flow-typecheck`, `gate-decision-flow-build`, `gate-decision-flow-test`가 이 계약 문서를 `depends_on`으로 참조해야 한다. [reversible]
- 관련 구현 파일과 대응 테스트 또는 gate 실행 결과가 저장소/ledger에서 확인되어야 한다. [reversible]

## 관련 소스

- `decision-flow/src/schema.ts`
- `decision-flow/src/engine.ts`
- `decision-flow/src/comparison.ts`
- `decision-flow/src/observe.ts`
