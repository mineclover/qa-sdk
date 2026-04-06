---
def:
  id: cli-minor-gaps-todo
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  links:
    - target: cli-flow-store
      type: depends_on
---

# CLI Minor Gaps — 구현 TODO

## 목적 ^purpose

CLI 명령 표면에서 아직 구조적으로 남아 있는 작은 부채와 다음 정리 대상을 추적한다.

## 잔여 항목 (1건)

### smoke coverage

- [ ] `dkg audit-events` + ingest forwarding e2e smoke를 CLI 회귀 세트에 포함 (서비스 의존 — CI 셋업 필요)

## 닫힌 항목 (결정 완료)

### usage metadata 확장 — 불필요

전 명령군이 이미 CliCommandNode + metadata 기반. 추가 확장 불필요.

### review/quality address parity — 불필요

review는 파일 경로(glob) 기반, quality는 bundle-doc-id 기반. 좌표 address와 다른 식별 체계를 사용하므로 address 추가는 부적절.

### boundary address smoke — 이미 완료

`def.test.ts`에 `boundary --address`, `boundary-context --address` smoke 존재.

## 완료 항목

- [x] `spec drift`, `def help`, `quality` root alias 등 모든 예외 표면을 runtime tree 모델에 흡수
- [x] CliCommandNode tree 전 명령군 마이그레이션 (17개 + root)
- [x] `executeCommand()` 공통 경로 + 서브트리 help 생성형
- [x] `CommandDescriptor` authored SSOT + `cli-command` 패키지
- [x] GraphQL/REST/CLI address-first 구현
- [x] `def scan` alias 정리, `dkg audit-events`, `document_links` address
- [x] cli-command dead export 제거 (`composeTree`, `resolveCommand`, `parseCommandArgs`)
- [x] cli-command 테스트 +5건 (17→23): empty path guard, onHelp/onNotFound, args/options 렌더, children-only resolve
- [x] `RestCommandHandler` 타입 중앙화 (17곳 → `command-spec.ts` 단일)
- [x] `resolveSubcommandInternal` if-chain → `TREE_COMMAND_GROUPS` 루프
