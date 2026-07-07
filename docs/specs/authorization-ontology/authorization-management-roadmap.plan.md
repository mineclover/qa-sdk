---
def:
  id: authorization-management-roadmap-plan
  tier: component
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: draft
  layer: operation
  tags: [security, observability, structural, entry-point]
  links:
    - target: authorization-management-usecases
      type: traces_to
    - target: authorization-management-hardening-todo
      type: traces_to
    - target: authorization-ontology-system
      type: traces_to
sources:
  - packages/authorization-ontology/src/index.ts
  - packages/authorization-ontology/src/index.test.ts
  - packages/authorization-ontology/src/permission-engine-bridge.test.ts
  - packages/authorization-monitor-web/src/main.ts
  - packages/authorization-monitor-web/scripts/static-smoke.mjs
---

# Authorization Management Roadmap — 권한 관리 목표와 단계

## 목적 ^purpose

proxy, application, Cerbos, permission-engine, lineage, decision observation을 하나의 운영 가능한 권한 관리 시스템으로 수렴시키기 위한 목표와 단계를 정리한다.

## 현재 목표

권한 실행 엔진을 하나로 합치지 않고, 각 실행 계층의 장점을 유지한다.

- proxy는 ingress 차단을 담당한다.
- application middleware는 domain resource/action 단위 권한을 담당한다.
- Cerbos는 선언형 policy decision point로 남긴다.
- permission-engine은 bitmask 기반 O(1) check 커널로 남긴다.
- authorization-ontology는 선언/적용/판정/피드백을 graph로 관측한다.

## Topdown Family Alignment — authorization-ontology-system

This pass used `qa-sdk def topdown authorization-ontology-system`, `docs collect authorization-ontology-system --family-only --json`, and `docs status authorization-ontology-system --json`.

| field | value |
|-------|-------|
| existing roles | `spec`, `plan`, `todo`, `rule`, `knowledge` |
| existing same-family roles | `knowledge` via the `authorization-ontology-system` root knowledge document |
| linked context roles | `spec` via graph store and usecase leaves; `plan` via roadmap and operational pack plans; `todo` via hardening TODO; `rule` via usage rule; `knowledge` via contained ontology concept leaves |
| missing roles | `cases`, `test`, `memo`, `prd`, `ralph-prd-json` |
| missing same-family roles | `spec`, `plan`, `todo`, `rule`, `cases`, `test`, `memo`, `prd`, `ralph-prd-json` |
| actionable TODO count | 17 open checklist rows |
| deferred TODO count | 0 open checklist rows |
| parking-lot TODO count | 0 open checklist rows |
| completed record candidates | 0 (`completedRecords: []`) |
| source refs | 31 frontmatter source refs |
| diagnostics | 0 |

No role document is created by this pass. Missing roles remain absence metadata until a concrete cases, test, memo, PRD markdown, or ralph PRD JSON artifact exists. All open hardening follow-ups remain `Actionable`; this pass does not select a Caddy/AuthentiK/Pulumi adapter, token remediation workflow, audit gate, monitor panel, regression test, masking rule, or graph export policy for implementation.

## Phase 1 — 구현된 capability 안정화

현재 완료된 projector와 audit surface를 유지 가능한 계약으로 고정한다.

- Cerbos policy projection
- proxy route projection
- application middleware projection
- permission-engine bridge projection
- middleware feedback projection
- authorization graph audit
- monitor web split

## Phase 2 — Store/API 연결

현재 in-memory/sample graph 중심 구조를 실제 운영 데이터로 연결한다.

- graph snapshot store
- decision ingest API
- route-policy map API
- audit report API
- monitor web live API

## Phase 3 — 배포 자동화 연동

권한 wiring을 수동 map에서 배포 산출물 기반으로 전환한다.

- Pulumi output 기반 service/policy wiring
- ArgoCD application metadata 기반 deployment provenance
- Caddy/AuthentiK/Nginx adapter
- Cerbos bundle source adapter

## Phase 4 — Coverage Gate

권한 topology drift를 운영 gate로 승격한다.

- proxy route coverage
- app domain resource coverage
- decision-policy-action consistency
- middleware feedback severity
- column lineage policy propagation

## Phase 5 — 운영 UI

authorization-monitor-web을 실제 운영 화면으로 전환한다.

- live graph 조회
- audit issue navigation
- decision timeline
- policy/source diff
- RLSC layout regression

## 장기 목표

권한 체계를 “실행 엔진별 설정 파일 모음”이 아니라, 식별 가능한 권한 graph로 운영한다. 각 권한 엔진은 실행 책임만 담당하고, 권한 선언/적용/관측/감사는 authorization ontology의 좌표계에서 비교한다.
