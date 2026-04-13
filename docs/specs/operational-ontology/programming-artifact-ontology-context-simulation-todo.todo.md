---
def:
  id: programming-artifact-ontology-context-simulation-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract, observability]
  links:
    - target: programming-artifact-ontology-context-simulation-plan
      type: refines
    - target: programming-artifact-ontology-system
      type: refines
---

# Programming Artifact Ontology Context Simulation — 구현 TODO

## 목적 ^purpose

프로그래밍 artifact ontology의 context selection, data flow, implementation trace, evidence interpretation 규칙을 fixture simulation으로 검증하기 위한 구현 항목을 추적한다.

## 구현 항목

- [ ] `programming-artifact-ontology-context-simulation.spec.md` 생성
- [ ] system spec의 contains/overview에 simulation spec 연결
- [ ] simulation spec에 Registry -> Topology -> Evidence -> Interpretation -> Governance Action -> Prompt Consumption 계층 정의
- [ ] 작업 유형별 read context contract 정의: quality-status discovery, quality-ledger fallback, freshness SLA, registry allocation boundary
- [ ] data flow contract 정의: input shape, transform function, output shape, invariant, warning/action
- [ ] implementation trace convention 정의: 문서 `sources`, 함수 symbol ref, test title, warning code 연결 규칙
- [ ] fixture 기반 simulation test 위치 결정: `packages/cli/src/commands` 또는 `packages/cli/src/lib`
- [ ] quality-status verified snapshot scenario 추가
- [ ] quality-status partial snapshot scenario 추가: partial gate coverage는 `incomplete`, not `failed`
- [ ] quality-status missing snapshot scenario 추가
- [ ] quality-status invalid snapshot scenario 추가
- [ ] explicit quality-ledger verified fallback scenario 추가
- [ ] explicit quality-ledger incomplete/failure scenario 추가
- [ ] snapshot/ledger conflict scenario 추가
- [ ] freshness SLA stale scenario 추가
- [ ] freshness timestamp missing scenario 추가: missing timestamp는 `incomplete`, not `stale`
- [ ] `source.qualityStatusRecords` raw evidence projection assertion 추가
- [ ] `source.governanceClosure` interpreted status assertion 추가
- [ ] `artifacts[].quality.metrics[governance_closure]` prompt consumption assertion 추가
- [ ] governance action matrix assertion 추가: `close_governance_evidence`, `create_programming_artifact_registry_record`
- [ ] build artifact + quality-status sidecar non-quality scenario 추가
- [ ] generated-source artifact scenario 초안 추가 여부 결정
- [ ] deployment-output artifact scenario 초안 추가 여부 결정
- [ ] prompt-artifact regeneration trace scenario 초안 추가 여부 결정
- [ ] existing relation vocabulary로 충분한지 review하고, 부족하면 새 relation 후보를 5Q checklist로 분리
- [ ] simulation spec과 `programming-artifact-ontology-development-guide`의 작업 시작 context 순서 동기화
- [ ] `qa-sdk def validate` 통과 확인
- [ ] 관련 targeted test 통과 확인: `pnpm --filter @qa-sdk/cli test -- --run src/commands/ontology.test.ts`

## 보류 항목

- [ ] registry-service/index-meta allocation lifecycle simulation은 별도 boundary-crossing PRD로 분리
- [ ] production registry persistence 연동은 local simulation matrix가 안정된 뒤 별도 판단
- [ ] artifact evidence provider 공통 interface 추출은 build/generated/deploy scenario가 최소 1회씩 검증된 뒤 판단
