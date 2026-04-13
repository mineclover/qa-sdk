---
def:
  id: programming-artifact-ontology-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract]
  links:
    - target: programming-artifact-ontology-plan
      type: refines
---

# Programming Artifact Ontology — 구현 TODO

## 목적 ^purpose

프로그래밍 산출물 기준 context extraction을 fallback 검색이 아닌 관리된 ontology provider로 승격하기 위한 구현 항목을 추적한다.

## 구현 항목

- [x] `PromptArtifactContextProvider` / registry 인터페이스 추가
- [x] `qa-sdk ontology prompt extract-artifact <artifact-ref>` fallback CLI 추가
- [x] `--persist-governance`로 prompt extraction governance evidence 저장
- [x] `programming-artifact-ontology` pack schema 초안 작성
- [x] artifact kind vocabulary 정의: build, generated-source, quality-status, deployment-output, prompt-artifact
- [x] artifact relation vocabulary 정의: produced_by, derived_from, verifies, owned_by_definition, materializes_output
- [x] artifact registry store 인터페이스 정의
- [x] artifact registry provider를 `PromptArtifactContextProvider`로 구현
- [x] 지속 개발 context 확인 순서와 handoff guide 작성
- [x] artifact registry CLI surface spec 작성
- [x] `extract-artifact`가 registry provider를 우선 사용하도록 연결
- [x] artifact provider용 unit test 추가
- [x] codegen/quality export 명령에서 artifact registry record 생성
- [x] deployment-output, prompt-artifact 생성 경로에서 registry record 생성 대상 여부 결정
- [x] export write path별 relation 채움 규칙 구현: produced_by, derived_from, verifies, owned_by_definition, materializes_output
- [x] build output registry hook 추가: `ontology artifact registry append --kind build`로 build output path를 registry record로 등록
- [x] deployment-output registry hook 구현: `infra deploy`/post-deploy output을 `kind=deployment-output` record로 append
- [x] prompt-artifact registry hook 구현: prompt artifact가 stdout이 아니라 파일/registry로 materialize될 때 `kind=prompt-artifact` record로 append
- [x] artifact ref가 없는 자유 문자열 fallback의 품질 등급을 별도 warning으로 분리
- [x] `extract-artifact --json`에 registry hit/miss/file/doc/search fallback source를 구조화해 출력
- [x] artifact registry JSON validate/list/append CLI 필요 여부 결정 및 최소 surface 구현
- [x] `extract-artifact --artifact-registry`가 관련 `quality-status` record를 찾아 prompt governance evidence와 JSON `qualityStatusRecords` 요약에 연결
- [x] quality-status JSON payload의 bundle/gate pass-fail 세부 상태를 governance verdict와 직접 연결
- [x] `evaluatePromptArtifactQuality()`가 artifact extraction quality-status evidence를 받아 `governance_closure` score와 warning에 반영
- [x] `quality export --artifact-registry` record metadata에 bundle state, gate count, claim count, generated timestamp closure 요약 추가
- [ ] quality export JSON snapshot evidence가 부족한 실제 사례가 나오면 quality-ledger lookup을 별도 provider/fallback으로 추가
- [ ] quality-status `generatedAt` 기반 stale SLA가 필요해지면 freshness threshold와 warning policy를 별도 story로 추가
