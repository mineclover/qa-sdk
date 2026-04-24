---
def:
  id: cli-command-registry-plan
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [structural]
  links:
    - target: cli-command-group
      type: traces_to
    - target: cli-command-spec
      type: traces_to
    - target: cli-minor-gaps-todo
      type: traces_to
---

# CLI Command Registry — 전환 완료

## 목적 ^purpose

CLI 명령 메타데이터를 authored descriptor에서 runtime tree와 help로 파생시키는 전환을 완료하고, 최종 구조를 확정한다.

## 현재 상태

- `cli-command` 패키지가 `CommandDescriptor`, `CliCommandNode`, `executeCommand()`를 제공한다.
- 모든 command group이 descriptor-authored SSOT(Single Source of Truth)로 전환되었다.
- `index.ts`는 더 이상 명령 데이터를 직접 기술하지 않고, group file들을 조립하는 entry 역할만 수행한다.
- `spec drift`, `def help`, `def scan`, `def read`, `quality` root alias 등 기능 표면은 runtime tree 모델에 흡수되었다.
- representative `docs/skills/*.md`는 `검증 매핑`과 `skills-workflows.test.ts`로 command/help/execution smoke에 연결되었다.
- `service mode` / `ingest mode` profile 전환은 `ingest-mode.e2e.test.ts`로 안정화되었다.
- `quality show` / `quality run`은 fixture gate 문서 기준 smoke로 고정되었다.
- `dkg audit-events`는 local ingest forwarding e2e로 검증된다.
- `sync-obsidian` write path는 installed Obsidian CLI + dedicated vault env 기반 gated smoke로 관리한다.
- `dkg self-check` full path heavy smoke는 `QA_SDK_RUN_HEAVY_SMOKE=1` env로 CI workflow에 연결되었다.

## 완료된 단계

- 모든 group file 분리와 local dead metadata 제거 완료
- handler registry를 object map/Proxy 기반으로 축소 완료
- alias surface와 legacy fallback switch를 대부분 tree/runtime 모델로 이동 완료
- skill workflow 문서의 대표 시나리오를 테스트 표면에 연결 완료
- `HOME` 격리 기반 service-profile integration smoke 안정화 완료

## 남은 후속 안정화

- 무거운 full execution smoke는 별도 lane으로 유지한다.
- 현재 normal regression에는 representative smoke만 포함한다.
- 세부 잔여 항목이 다시 생기면 `cli-minor-gaps.todo.md`에서 추적한다.
