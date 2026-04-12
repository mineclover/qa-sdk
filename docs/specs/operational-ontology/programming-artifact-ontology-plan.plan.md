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
    - target: decision-definition-bridge
      type: depends_on
---

# Programming Artifact Ontology — 방향 계획

## 목적 ^purpose

프로그래밍 산출물을 코드 파일이나 문서 ID가 아닌 독립 target으로 관리하기 위한 장기 계획을 정의한다. 목표는 build output, generated SDK, quality status JSON, prompt artifact, deployment output 같은 산출물을 외부 provider가 해석하고, `operational-ontology` prompt extraction이 같은 provider contract로 context를 받을 수 있게 하는 것이다.

## 현재 목표

현재 구현은 `programming-artifact-ontology` pack schema, artifact kind/relation vocabulary, in-memory registry store, `ArtifactRegistryPromptArtifactContextProvider`, `extract-artifact --artifact-registry` 우선 조회, `extract-artifact --json` fallback source 구조화, codegen/quality export registry append 초안까지 열린 단계다. 다음 목표는 build/deployment/prompt artifact 생성 경로를 실제 산출물 파일 write와 연결하고, governance closure를 quality gate 결과와 연결하는 것이다.

## 장기 목표

programming/artifact ontology는 별도 pack 또는 plugin으로 관리한다. 이 pack은 `artifactRef -> producing command/gate -> output path -> owning definition -> verification refs -> governance run` 경로를 제공한다.

## 단계

0. 개발 지침과 context handoff 고정
   system spec, plan, todo, CLI spec, development guide 순서를 세션 시작 표준으로 유지한다.
1. Provider contract 안정화
   `PromptArtifactContextProvider`를 외부 plugin이 구현할 수 있는 최소 surface로 유지한다.
2. Artifact vocabulary 정의
   build artifact, generated source, quality snapshot, deployment output, prompt artifact를 닫힌 vocabulary로 분류한다.
3. Artifact registry 도입
   산출물 ref, producing command, source inputs, verification gate, owner definition을 저장한다.
4. CLI provider 연결
   `qa-sdk ontology prompt extract-artifact`가 registry provider를 먼저 조회하고 fallback search는 보조 경로로만 사용한다.
5. Export write path 연결
   codegen과 quality export는 `--artifact-registry`로 registry record를 append한다. build output은 아직 CLI-owned export surface가 없어 factory만 공유하고, deployment output과 prompt artifact는 파일/registry로 materialized 되는 경로에서 record를 생성한다.
6. Fallback 품질 분리
   registry hit/miss, file/doc fallback, free-string search fallback을 CLI JSON `source`와 quality warning에서 구분한다.
7. Governance closure 연결
   artifact extraction 결과를 실제 governance run persistence와 연결해 synthetic evidence 의존도를 낮춘다.

## 다음 세션 기준

다음 세션은 `programming-artifact-ontology-development-guide`의 컨텍스트 확인 순서를 먼저 따른다. 실행 목표는 `programming-artifact-ontology-todo`의 미완료 항목 중 export write path, fallback 품질 분리, governance closure 순서로 선택한다.
