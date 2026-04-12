---
def:
  id: programming-artifact-ontology-plan
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, observability, contract]
  links:
    - target: operational-ontology-prompt-artifact-generation
      type: refines
    - target: operational-ontology-pack-interface
      type: depends_on
    - target: decision-definition-bridge
      type: depends_on
---

# Programming Artifact Ontology — 방향 계획

## 목적 ^purpose

프로그래밍 산출물을 코드 파일이나 문서 ID가 아닌 독립 target으로 관리하기 위한 장기 계획을 정의한다. 목표는 build output, generated SDK, quality status JSON, prompt artifact, deployment output 같은 산출물을 외부 provider가 해석하고, `operational-ontology` prompt extraction이 같은 provider contract로 context를 받을 수 있게 하는 것이다.

## 현재 목표

현재 구현은 `PromptArtifactContextProvider`를 통해 외부 provider 주입 패턴을 열고, CLI에서 `extract-artifact` fallback을 제공하는 단계다. 산출물 ref가 code path나 doc id이면 기존 해석으로 위임하고, 자유 문자열이면 definition 후보 검색으로 최소 context를 만든다.

## 장기 목표

programming/artifact ontology는 별도 pack 또는 plugin으로 관리한다. 이 pack은 `artifactRef -> producing command/gate -> output path -> owning definition -> verification refs -> governance run` 경로를 제공한다.

## 단계

1. Provider contract 안정화
   `PromptArtifactContextProvider`를 외부 plugin이 구현할 수 있는 최소 surface로 유지한다.
2. Artifact vocabulary 정의
   build artifact, generated source, quality snapshot, deployment output, prompt artifact를 닫힌 vocabulary로 분류한다.
3. Artifact registry 도입
   산출물 ref, producing command, source inputs, verification gate, owner definition을 저장한다.
4. CLI provider 연결
   `qa-sdk ontology prompt extract-artifact`가 registry provider를 먼저 조회하고 fallback search는 보조 경로로만 사용한다.
5. Governance closure 연결
   artifact extraction 결과를 실제 governance run persistence와 연결해 synthetic evidence 의존도를 낮춘다.
