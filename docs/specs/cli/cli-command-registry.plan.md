---
def:
  id: cli-command-registry-plan
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  svc: cli
  tags: [structural]
  links:
    - target: cli-command-group
      type: depends_on
    - target: cli-minor-gaps-todo
      type: depends_on
---

# CLI Command Registry — 정리 계획

## 목적 ^purpose

CLI 명령 목록이 `resolveSubcommand`, dispatch switch, usage text에 중복 선언되는 구조를 줄이고 drift를 막는 실행 계획을 고정한다.

## 문제

- 같은 명령이 여러 배열과 switch에 흩어져 있다.
- `def outgoing`처럼 한 곳만 빠져도 실제 surface와 help/dispatch가 어긋난다.
- 새 명령 추가 시 build/test보다 늦게 문서와 usage가 따라오는 경우가 생긴다.

## 현재 기반 인터페이스

- `packages/cli/src/command-spec.ts`
  - `CommandUsageSpec`
  - `CommandDetailSpec`
  - `CommandHelpSectionSpec`
  - usage/help renderer helper

새 command group을 registry SSOT로 옮길 때는 이 인터페이스를 기본 진입점으로 사용한다.

## 단계

### P1. registry SSOT

- [x] `def` 명령군을 SSOT 배열로 추출
- [x] `resolveSubcommand()`와 top-level dispatch가 같은 목록을 사용
- [x] `dkg` 명령군의 two-word / three-word 표면을 SSOT 배열과 helper dispatch로 정리
- [x] `service` 명령군의 two-word / three-word 표면도 SSOT 배열과 helper dispatch로 정리
- [x] `quality` 명령군도 two-word SSOT 배열과 helper dispatch로 정리
- [x] `review` 명령군도 two-word SSOT 배열과 helper dispatch로 정리
- [ ] usage/help line 생성까지는 아직 수동 유지

현재는 `def`, `dkg`, `service`, `quality`, `review` command group을 먼저 정리했고, 남은 큰 중복은 usage/help 생성 쪽이다.

### P2. parser / dispatch 통합

- `resolveSubcommand()`가 registry를 읽도록 전환
- top-level switch를 registry 기반 dispatch로 축소

### P3. usage 생성

- [x] `service`, `quality`, `review` top-level usage line을 metadata에서 생성
- [x] `def help`를 section metadata에서 생성
- [x] `dkg` top-level usage 블록을 metadata에서 생성
- [x] `motion/spec/dx/flow/ingest/gate/query/catalog/obs/test` top-level usage 블록도 metadata에서 생성
- [x] `Commands:` 아래 핵심 세부 옵션 블록(sync-obsidian/scan git/git conflicts/register/dry-run/codegen/inspect)도 metadata에서 생성
- [ ] 나머지 command-specific 세부 usage 블록을 metadata 기반으로 넓힐지 결정

### P4. 회귀

- 새 명령 추가 시
  - parser
  - dispatch
  - usage
  - docs
가 동시에 갱신되는지 확인하는 smoke를 추가

## 검증

1. `pnpm --filter @qa-sdk/cli build`
2. `pnpm --filter @qa-sdk/cli exec vitest run src/commands/def.test.ts`
3. `qa-sdk def help`
4. 실제 명령 smoke (`def outgoing`, `dkg audit-events` 등)
