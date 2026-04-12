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
    - target: operational-ontology-prompt-artifact-generation
      type: depends_on
---

# Programming Artifact Ontology — 구현 TODO

## 목적 ^purpose

프로그래밍 산출물 기준 context extraction을 fallback 검색이 아닌 관리된 ontology provider로 승격하기 위한 구현 항목을 추적한다.

## 구현 항목

- [x] `PromptArtifactContextProvider` / registry 인터페이스 추가
- [x] `qa-sdk ontology prompt extract-artifact <artifact-ref>` fallback CLI 추가
- [x] `--persist-governance`로 prompt extraction governance evidence 저장
- [ ] `programming-artifact-ontology` pack schema 초안 작성
- [ ] artifact kind vocabulary 정의: build, generated-source, quality-status, deployment-output, prompt-artifact
- [ ] artifact registry store 인터페이스 정의
- [ ] build/codegen/quality export 명령에서 artifact registry record 생성
- [ ] `extract-artifact`가 registry provider를 우선 사용하도록 연결
- [ ] artifact provider용 unit test 추가
- [ ] artifact ref가 없는 자유 문자열 fallback의 품질 등급을 별도 warning으로 분리
- [ ] artifact governance run을 실제 quality gate 결과와 연결
