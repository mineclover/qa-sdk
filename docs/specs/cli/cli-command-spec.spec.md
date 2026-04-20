---
def:
  id: cli-command-spec
  level: module
  tier: system
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: cli-command
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
- 테스트/운영 문서도 같은 metadata 모델과 충돌하지 않게 representative smoke로 연결한다

## 현재 상태

전 18개 명령군 + root가 `CommandDescriptor` authored SSOT + `CliCommandNode` runtime tree 모델로 통합 완료.

- **명령군**: scan, git, prefix, facet, def, service, dkg, quality, review, ingest, obs, gate, query, spec, test, catalog, motion, flow + root
- **레거시 표면**: 기능 표면은 tree 모델에 흡수됐다. 다만 `quality` 1단어 resolve fallback과 `DEF_TOP_LEVEL_USAGE_LINES` 같은 얇은 호환 레이어는 남아 있다.
- **dispatch**: `TREE_COMMAND_GROUPS` 배열 루프 기반. `resolveSubcommandInternal`도 동일 배열 순회
- **타입 공유**: `RestCommandHandler`를 `command-spec.ts`에서 중앙 export → 16개 command-group에서 import
- **help 생성**: top-level USAGE + 모든 명령군 서브트리 help (`--help` 자동)
- **workflow 검증**: representative `docs/skills/*.md`는 `packages/cli/src/skills-workflows.test.ts`와 연결되고, profile 전환은 `packages/cli/src/commands/ingest-mode.e2e.test.ts`로 안정화됐다.

### 설계 결정 (닫힌 항목)

- usage metadata 추가 확장 — 불필요. 전 명령군이 이미 CliCommandNode + metadata 기반
- review/quality address parity — 불필요. review는 glob, quality는 bundle-doc-id. 좌표 address와 다른 식별 체계
- address-first 구현 — GraphQL/REST/CLI 모두 address 기반 완료

## 검증 표면

- `packages/cli-command/__tests__/*`
  - descriptor → tree compose, resolve, parse, execute, help renderer
- `packages/cli/src/commands/*.test.ts`
  - 명령군별 parse/help/runtime 회귀
- `packages/cli/src/skills-workflows.test.ts`
  - `docs/skills/*.md` 대표 workflow ↔ command/help/execution smoke 매핑
- `packages/cli/src/commands/ingest-mode.e2e.test.ts`
  - `service mode` / `ingest mode` profile 전환과 `HOME` 격리 검증
- `packages/cli/src/commands/quality-smoke.e2e.test.ts`
  - fixture gate 문서 기준 `quality show` / `quality run` 실제 실행 smoke
- `packages/cli/src/commands/sync-obsidian-write.e2e.test.ts`
  - 설치된 Obsidian CLI + dedicated vault env 기준 실제 write path smoke
- `.github/workflows/ci.yml`
  - `QA_SDK_RUN_HEAVY_SMOKE=1` 기반 `dkg self-check` full path heavy smoke lane
- `node packages/cli/dist/index.js def validate`
- `node packages/cli/dist/index.js def scan-audit`

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
- `service-profile` 경로 계산을 런타임 해상도로 전환해 `HOME` 기반 테스트 격리 안정화
- representative skill workflow 문서에 `검증 매핑`을 추가하고 smoke test로 연결

## 관련 소스

- `packages/cli-command/src/` — types, compose, help, resolve, execute, parse
- `packages/cli/src/command-spec.ts` — cli-command 감싸는 import shim + `RestCommandHandler` 중앙 export
- `packages/cli/src/command-groups/*.commands.ts` — 18개 명령군 descriptor + handler registry
- `packages/cli/src/index.ts` — TREE_COMMAND_GROUPS, dispatch, USAGE
