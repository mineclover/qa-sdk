---
def:
  id: programming-artifact-ontology-context-simulation-plan
  level: leaf
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract, observability]
  links:
    - target: programming-artifact-ontology-system
      type: refines
    - target: programming-artifact-ontology-cli
      type: depends_on
    - target: operational-ontology-prompt-artifact-generation
      type: depends_on
    - target: programming-artifact-ontology-context-simulation-todo
      type: traces_to
---

# Programming Artifact Ontology Context Simulation — 방향 계획

## 목적 ^purpose

프로그래밍 artifact ontology를 기능별 CLI 동작 묶음이 아니라 context selection, data flow, implementation trace를 명시적으로 검증하는 meta-framework로 승격하기 위한 simulation 계획을 정의한다. 목표는 agent나 사람이 문서를 읽을 때 필요한 context boundary를 안정적으로 선택하고, artifact/evidence 데이터 흐름과 구현 추적 경로를 fixture 기반으로 증명하게 만드는 것이다.

## 현재 목표

현재 programming-artifact ontology는 registry record, quality-status snapshot, explicit quality-ledger fallback, freshness policy, prompt quality governance closure를 연결하는 단계에 있다. 다음 목표는 이 연결이 quality-status 특화 구현이 아니라 build, generated-source, deployment-output, prompt-artifact까지 확장 가능한 계층 모델임을 simulation matrix로 검증하는 것이다.

## 장기 목표

프로그래밍 작업은 자유 검색이 아니라 context contract를 통해 시작해야 한다. 작업 유형이 주어지면 system/module/leaf 문서, 구현 파일, evidence source, out-of-scope boundary가 구조적으로 선택되고, data flow transform과 invariant가 테스트로 추적되어야 한다. 이 계획은 local JSON registry 단계에서 시작하지만, 향후 registry-service/index-meta allocation lifecycle로 승격할지 여부를 판단하는 근거를 만든다.

## 계층 모델

| 계층 | 질문 | 입력 | 출력 | 핵심 불변식 |
|------|------|------|------|-------------|
| Context Selection | 무엇을 읽어야 하는가 | task kind, root artifact/doc | required/optional/excluded context | 관련 문서와 boundary-crossing 대상이 구분된다 |
| Registry Instance | 어떤 산출물인가 | artifact ref, registry JSON | direct record, sidecar records | direct hit와 quality sidecar는 분리된다 |
| Topology Expansion | 어떤 graph surface인가 | definition root/bundle/gate refs | contained docs, GateDescriptor[] | contains traversal과 docVersion 정책이 일관된다 |
| Data Flow | 데이터가 어떻게 흐르는가 | registry/snapshot/ledger payload | transform trace | input shape, transform, output shape가 명시된다 |
| Evidence Interpretation | 어떤 상태인가 | snapshot, ledger, freshness | quality-status outcome | incomplete와 failed를 섞지 않는다 |
| Governance Action | 무엇을 닫아야 하는가 | closure status, quality signal | management actions | search fallback action과 governance action은 분리된다 |
| Prompt Consumption | prompt가 무엇을 소비하는가 | workArea, sources, quality evidence | prompt artifact, quality metrics | evidence가 없는 일반 prompt extraction은 기존 동작을 유지한다 |

## 단계

1. Context/dataflow simulation spec 작성
   `programming-artifact-ontology-context-simulation` spec을 추가해 context contract, data flow contract, scenario matrix를 하나의 실행 가능한 명세로 묶는다.
2. Quality-status simulation matrix 구현
   verified, incomplete, missing, invalid, stale, ledger fallback, conflict 케이스를 fixture로 검증한다.
3. Non-quality artifact scenario 추가
   build artifact + quality-status sidecar를 첫 non-quality fixture로 추가해 framework 일반성을 검증한다.
4. Artifact kind 확장 검증
   generated-source, deployment-output, prompt-artifact에 대해 최소 scenario를 추가한다.
5. Traceability convention 고정
   문서 `sources`, 테스트명, warning code, transform function 이름이 서로 추적 가능하도록 작성 규칙을 문서화한다.
6. Vocabulary pressure review
   기존 `verifies` relation이 상태 보고 의미까지 감당 가능한지 simulation 결과로 판단한다. 새 relation이 필요하면 5Q checklist를 별도 decision으로 실행한다.

## 비범위

- registry-service/index-meta allocation lifecycle 구현은 포함하지 않는다.
- 새 artifact kind 또는 relation kind 추가는 이 계획의 기본 목표가 아니다.
- quality-ledger를 암묵적으로 읽는 동작은 포함하지 않는다.
- simulation은 production storage를 대체하지 않고 context/evidence 해석 규칙을 검증한다.

## 완료 기준

- 새 simulation spec이 system module에 연결된다.
- simulation fixture가 Registry -> Topology -> Evidence -> Interpretation -> Governance Action -> Prompt Consumption projection을 단계별로 assert한다.
- partial gate coverage가 `failed`가 아니라 `incomplete`로 남는 invariant가 테스트로 고정된다.
- 적어도 하나의 non-quality artifact kind가 quality-status sidecar와 함께 검증된다.
- `qa-sdk def validate`가 통과한다.
