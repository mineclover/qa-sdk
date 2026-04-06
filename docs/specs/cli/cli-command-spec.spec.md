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

## 핵심 타입

- `CommandDescriptor`
  - authored SSOT용 명령 기술자
  - `id`
  - `path`
  - `usage`
  - `continuation`
  - `args`
  - `options`
  - `handlerKey`
- `CommandUsageSpec`
  - top-level usage line
- `CommandDetailSpec`
  - `Commands:` 아래 옵션 블록
- `CommandHelpSectionSpec`
  - `def help` 같은 섹션형 help
- `CliCommandNode`
  - 재귀 명령 트리
  - `segment`
  - `usage`
  - `continuation`
  - `options`
  - `children`
  - `handlerKey`

## 설계 원칙

- parser, dispatch, help는 같은 command metadata를 보아야 한다.
- authored metadata는 가능하면 `CommandDescriptor`에서 시작하고, runtime tree는 파생된다.
- 사람이 읽는 label과 실행 handler는 분리한다.
- 다단 명령은 재귀 tree로 모델링한다.
- public parse 결과는 단순 `name/rest`를 유지해 기존 호출자를 깨지 않는다.
- tree runtime은 `executeCommand()`를 통해 공통 실행 경로를 가진다.
- `--help`는 가능하면 top-level 전체 usage보다 서브트리 help를 우선 렌더링한다.

## 현재 상태

- 공통 인터페이스 구현: `packages/cli-command/src/*`
- `CommandDescriptor -> descriptorsToTree()` 계층이 추가되었다.
- `packages/cli/src/command-spec.ts`는 `cli-command` package를 감싸는 호환용 import shim
- tree pilot: `service`, `def`, `dkg`, `quality`, `review`
- tree pilot: `service`, `def`, `dkg`, `quality`, `review`, `ingest`, `obs`, `gate`, `query`, `spec`, `test`, `catalog`, `motion`, `flow`, `scan`, `git`, `prefix`, `facet`, root direct command
- descriptor-authored SSOT 적용:
  - `dkg`
  - `service`
  - `def`
  - `flow`
  - `quality`
  - `review`
  - `root`
  - `scan`
  - `git`
  - `prefix`
  - `facet`
  - `motion`
  - `spec`
  - `ingest`
  - `gate`
  - `query`
  - `test`
  - `catalog`
- `@qa-sdk/cli`는 `cli-command`를 package name import로 직접 소비한다.
- `packages/cli/package.json`의 `build`/`dev`/`test`는 `cli-command build`를 먼저 실행해 dist export를 보장한다.
- generated usage/help:
  - top-level `USAGE`
  - `def help`
  - `review request` continuation line
  - `service/ingest/obs` option-rich usage line
  - `service --help`, `dkg decisions --help` 같은 서브트리 help
  - `ingest --help`, `obs --help` 같은 서브트리 help
  - `gate --help`, `query --help` 같은 서브트리 help
  - `spec --help`, `test --help`, `catalog --help` 같은 서브트리 help
  - `motion --help`, `flow --help` 같은 서브트리 help
  - `prefix --help`, `scan --help`, `init --help` 같은 direct/root help

## 남은 예외

- `spec drift`
- `def help`
- `quality` root alias

이 표면은 현재 호환성/별도 구현 이유로 switch fallback에 남아 있다.

## 최적화 이력 (2026-04-06)

### cli-command 패키지

- `composeTree` dead export 제거 — 호출처 없는 API 표면 정리. `descriptorsToTree`만 유지
- `MutableCliCommandNode`를 `Omit<CliCommandNode, 'children'>` 파생으로 변경 — 필드 수동 복제 제거
- `descriptorsToTree`에 `path: []` guard 추가 — 빈 경로 descriptor silent 무시 방지
- 테스트 +5건 (23 total): compose empty path, execute onHelp/onNotFound, help args/options 렌더, resolve children-only 노드

### cli 패키지

- `command-spec.ts`에서 unused re-export 제거: `composeTree`, `resolveCommand`, `parseCommandArgs`
- `RestCommandHandler` 타입 중앙화 (`command-spec.ts` 단일 export → 16개 command-group 파일에서 import)
- `resolveSubcommandInternal` 수동 if-chain → `TREE_COMMAND_GROUPS` 루프 치환

## 관련 소스

- `packages/cli-command/src/index.ts`
- `packages/cli-command/src/types.ts`
- `packages/cli-command/src/compose.ts`
- `packages/cli-command/src/help.ts`
- `packages/cli-command/src/resolve.ts`
- `packages/cli-command/src/execute.ts`
- `packages/cli-command/src/parse.ts`
- `packages/cli/src/command-spec.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/command-groups/*.commands.ts`
