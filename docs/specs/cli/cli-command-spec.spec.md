---
def:
  id: cli-command-spec
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [structural]
  links:
    - target: cli-command-group
      type: refines
    - target: cli-command-registry-plan
      type: traces_to
---

# CLI Command Spec

## 목적 ^purpose

CLI 명령을 사람이 읽는 help, parser 해석, dispatch 연결, usage 렌더링까지 한 인터페이스로 공급하는 구조를 고정한다.

## 핵심 타입 ^defines

- `CommandDescriptor` — authored SSOT용 명령 기술자 (id, path, usage, continuation, args, options, handlerKey)
- `CliCommandNode` — 재귀 명령 트리 (segment, usage, continuation, options, children, handlerKey)
- `CommandUsageSpec` — top-level usage line
- `CommandDetailSpec` — `Commands:` 아래 옵션 블록
- `CommandHelpSectionSpec` — `def help` 같은 섹션형 help
- `RestCommandHandler` — `(rest: string[]) => Promise<void> | void` (command-spec.ts 중앙 export)

## 설계 원칙

- parser, dispatch, help는 같은 command metadata를 보아야 한다
- authored metadata는 `CommandDescriptor`에서 시작, runtime tree는 `descriptorsToTree()`로 파생
- 사람이 읽는 label과 실행 handler는 분리
- 다단 명령은 재귀 tree로 모델링
- public parse 결과는 단순 `name/rest` 유지 (기존 호출자 호환)
- tree runtime은 `executeCommand()`를 통해 공통 실행 경로
- `--help`는 서브트리 help를 우선 렌더링
- 빈 `path: []` descriptor는 guard로 무시 (silent 데이터 누락 방지)

## 현재 상태

전 18개 명령군 + root가 `CommandDescriptor` authored SSOT + `CliCommandNode` runtime tree 모델로 통합 완료.

- **명령군**: scan, git, prefix, facet, def, service, dkg, quality, review, ingest, obs, gate, query, spec, test, catalog, motion, flow + root
- **레거시 예외**: 없음. `spec drift`, `def help`, `quality` root alias 등 모든 레거시 표면이 tree 모델에 흡수
- **dispatch**: `TREE_COMMAND_GROUPS` 배열 루프 기반. `resolveSubcommandInternal`도 동일 배열 순회
- **타입 공유**: `RestCommandHandler`를 `command-spec.ts`에서 중앙 export → 16개 command-group에서 import
- **help 생성**: top-level USAGE + 모든 명령군 서브트리 help (`--help` 자동)

### 설계 결정 (닫힌 항목)

- usage metadata 추가 확장 — 불필요. 전 명령군이 이미 CliCommandNode + metadata 기반
- review/quality address parity — 불필요. review는 glob, quality는 bundle-doc-id. 좌표 address와 다른 식별 체계
- address-first 구현 — GraphQL/REST/CLI 모두 address 기반 완료

## 최적화 이력 (2026-04-06)

### cli-command 패키지

- `composeTree` dead export 제거 — `descriptorsToTree`만 유지
- `MutableCliCommandNode`를 `Omit<CliCommandNode, 'children'>` 파생으로 변경
- `descriptorsToTree`에 `path: []` guard 추가
- 테스트 +5건 (23 total): empty path, onHelp/onNotFound, args/options 렌더, children-only resolve

### cli 패키지

- unused re-export 제거: `composeTree`, `resolveCommand`, `parseCommandArgs`
- `RestCommandHandler` 타입 중앙화 (17곳 → `command-spec.ts` 단일)
- `resolveSubcommandInternal` if-chain → `TREE_COMMAND_GROUPS` 루프 치환

## 관련 소스

- `packages/cli-command/src/` — types, compose, help, resolve, execute, parse
- `packages/cli/src/command-spec.ts` — cli-command 감싸는 import shim + `RestCommandHandler` 중앙 export
- `packages/cli/src/command-groups/*.commands.ts` — 18개 명령군 descriptor + handler registry
- `packages/cli/src/index.ts` — TREE_COMMAND_GROUPS, dispatch, USAGE
