---
def:
  tier: component
  id: viteplus-playbook-boundary-relation
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: approved
  layer: experience
  svc: viteplus-sdk-smoke
  tags: [frontend, structural, observability]
  links:
    - target: viteplus-sdk-smoke-system
      type: refines
    - target: viteplus-playbook-template-implementation
      type: traces_to
    - target: viteplus-playbook-boundary-coupling
      type: traces_to
    - target: ms-concept-boundary
      type: implements
---

# Vite+ Playbook Boundary Relation

## 목적 ^purpose

context-action 패턴에서 사용하는 바운더리 단위 5종과 각 boundary의 scope 역할을 정의한다.

## 정의 ^defines

- **boundary 단위 5종** — page root, qa-bridge facade, feature context, handlers/actions, view
- **boundary = scope** — 각 boundary는 계약을 소유하는 scope. contract descent 원칙에 따라 상위→하위 하향

## 소비 ^consumes

- `ScopeContract` / `ScopeNesting` — boundary를 scope로 모델링 (`@qa-sdk/core`)
- `Boundary` 개념 — 패싯이 존재하는 검증 가능 기능 단위 (`ms-concept-boundary`)

## 구성 ^overview

- boundary는 "같은 최신 상태/refs/side effect 경계를 공유하는 단위"로 본다.
- 결합 규칙과 조회 표준은 `viteplus-playbook-boundary-coupling`에서 정의한다.

## 바운더리 단위

| 단위 | 역할 | 패싯 분포 | 권장 문서 좌표 |
|------|------|----------|----------------|
| page root | feature mount 시작점 | — | `flow/process_flow` |
| qa-bridge facade | session/trace/logging 경계 | 소비 | `feature/func_def` |
| feature context | store/refs/persist 경계 | 정의, 저장 | `feature/func_def` + `state/app_state` |
| handlers/actions | orchestration 경계 | 소비, 관리, 생산 | `feature/func_def` |
| view | 입력/표현 경계 | 소비 | `ui/interaction` |

## scope/aspect 배정 이유

- `scope: flow`
  핵심은 boundary들 사이의 연결 구조다.
- `aspect: relation`
  이 문서는 boundary 간 관계의 구조적 정의를 담당한다.
