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

### Completed — 완료 기록

- [x] `PromptArtifactContextProvider` / registry 인터페이스 추가
- [x] `qa-sdk ontology prompt extract-artifact <artifact-ref>` fallback CLI 추가
- [x] `--persist-governance`로 prompt extraction governance evidence 저장
- [x] `programming-artifact-ontology` pack schema 초안 작성
- [x] artifact kind vocabulary 정의: build, generated-source, quality-status, deployment-output, prompt-artifact, activation-evidence
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
- [x] `extract-artifact --json`의 `source.governanceClosure`가 quality-status found/missing/invalid/incomplete 상태, matched refs, warning/action을 노출
- [x] quality-status governance closure contract를 system/CLI/development guide/prompt artifact generation docs에 동기화
- [x] provider lookup, activation evidence, quality evidence concerns를 `programming-artifact-ontology-system` 하위 leaf 문서로 분리
- [x] `operational-ontology-registry-allocation.plan.md`와 `.todo.md`를 adjacent docs로 검토하고, ontology pack allocation lifecycle 변경이 없으므로 out of scope로 유지
- [x] quality export JSON snapshot evidence가 부족한 경우 explicit `--quality-ledger` fallback으로 resolved gate descriptor surface를 검증
- [x] quality-status `generatedAt` 기반 stale SLA가 필요해지면 freshness threshold와 warning policy를 별도 story로 추가
- [x] snapshot-first authority, ledger conflict warning, descriptor priority, freshness SLA를 system/CLI/development guide/prompt artifact generation docs에 반영
- [x] After US-006 through US-009 create real split CLI modules, narrow provider/activation-evidence/quality-evidence/CLI doc frontmatter sources from `packages/cli/src/commands/ontology.ts` to `artifact-registry.ts`, `prompt-extract-artifact.ts`, `quality-status-evidence.ts`, `quality-ledger-evidence.ts`, and `activation.ts` as applicable.
- [x] Do not add `@def.doc` comments for the split; frontmatter source narrowing reaches the precise programming artifact leaves through the extracted modules.

### Actionable — 실행 가능

현재 topdown alignment 기준으로 즉시 실행할 open checklist row는 없다.

### Deferred — 조건부 대기

- [ ] If generic `qa-sdk ontology prompt extract`, `extract-file`, and `extract-permission` need their own implementation boundary, split their shared materialization/governance helpers into `packages/cli/src/commands/ontology/prompt-extract.ts`; US-013 leaves them in `ontology.ts` only as router/dependency handoff debt because the file is under the verified line-count ceiling.
- [ ] local registry JSON을 registry-service/index-meta allocation lifecycle로 승격할 실제 운영 요구가 생기면 `operational-ontology-registry-allocation.plan.md` scope에서 새 story로 진행
- [ ] quality-status closure가 registry JSON/ledger 외 원격 quality service를 읽어야 하는 요구가 생기면 별도 provider boundary와 failure policy를 설계

### Parking Lot — 후보 보관

현재 보관 후보 open checklist row는 없다.
