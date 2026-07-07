---
def:
  id: task-test-permission-code
  type: knowledge
  knowledge_kind: guide
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: permission-engine
  tags: [testing, security, task-record]
  links:
    - target: perm-permission-code
      type: traces_to
sources:
  - packages/permission-engine/src/permission-code.ts
  - packages/permission-engine/src/permission-codec.test.ts
  - docs/specs/permission/perm-external-system/perm-permission-code.spec.md
---

# permission-code 테스트 보강

> permission-engine의 핵심 직렬화 모듈 5개 export가 테스트 미검증.

## 목적 ^purpose

permission-code test 보강 task의 완료 위치를 추적한다. 현재 구현 SSOT는 `permission-code.ts`, 검증 SSOT는 `permission-codec.test.ts`와 `perm-permission-code` 스펙이다.

## 우선순위: 🔴 1순위

## 대상

`packages/permission-engine/src/permission-code.ts`

| export | 설명 |
|---|---|
| `PermissionCode` | 인터페이스 — `{service-ref}.{type}.{resource}.{action}` |
| `PermCodeFactory` | 인터페이스 — 컨텍스트 바인딩된 코드 생성기 |
| `formatPermCode(code)` | PermissionCode → 문자열 직렬화 |
| `parsePermCode(raw)` | 문자열 → PermissionCode 파싱 |
| `createPermCodeFactory(ctx)` | ServiceContext → PermCodeFactory 생성 |

## 테스트 파일

`packages/permission-engine/src/permission-code.test.ts` (또는 demo-tests 해당 파일 보강)

## 시나리오

| # | 시나리오 | 설명 |
|---|---|---|
| 1 | formatPermCode 기본 | 각 필드 조합 → 문자열 |
| 2 | parsePermCode 왕복 | format → parse → format 동등 |
| 3 | parsePermCode 잘못된 입력 | 구분자 누락, 빈 필드 |
| 4 | createPermCodeFactory | 컨텍스트 바인딩 후 코드 생성 |
| 5 | type별 패턴 검증 | page(depth 3)/api(depth 4)/action(depth 3) |
