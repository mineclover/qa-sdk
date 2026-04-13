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

현재 구현은 `programming-artifact-ontology` pack schema, artifact kind/relation vocabulary, in-memory registry store, `ArtifactRegistryPromptArtifactContextProvider`, `extract-artifact --artifact-registry` 우선 조회, 관련 `quality-status` record sidecar discovery, quality export JSON snapshot 로딩, prompt quality `governance_closure` evidence 반영, `extract-artifact --json` fallback source 구조화, codegen/quality export/deployment output/prompt artifact/build output registry append, quality export registry metadata closure 요약까지 열린 단계다. 다음 목표는 JSON snapshot과 registry metadata만으로 부족한 경우 quality-ledger lookup이나 freshness SLA를 별도 story로 붙일지 판단하는 것이다.

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
   codegen, quality export, infra deploy output, prompt artifact output은 `--artifact-registry`로 registry record를 append한다. build output은 `ontology artifact registry append --kind build`로 실행 결과 path를 명시적으로 등록한다.
6. Fallback 품질 분리
   registry hit/miss, file/doc fallback, free-string search fallback을 CLI JSON `source`와 quality warning에서 구분한다.
7. Governance closure 연결
   artifact extraction 결과를 registry의 관련 `quality-status` record와 연결해 synthetic evidence 의존도를 낮춘다.
8. Quality payload verdict 연결
   quality-status JSON payload의 bundle/gate 상태를 governance verdict와 prompt quality closure에 직접 연결한다. 현재 단계는 `outputPath` JSON snapshot과 quality export registry metadata 요약 기반으로 완료됐고, ledger lookup과 freshness SLA는 후속 확장으로 남긴다.

## 다음 세션 기준

다음 세션은 `programming-artifact-ontology-development-guide`의 컨텍스트 확인 순서를 먼저 따른다. 실행 목표는 `programming-artifact-ontology-todo`의 미완료 항목 중 quality-ledger lookup, quality-status freshness SLA, 또는 registry allocation lifecycle 연동 여부를 선택한다.
