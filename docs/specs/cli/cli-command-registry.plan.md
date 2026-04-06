---
def:
  id: cli-command-registry-plan
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [structural]
  links:
    - target: cli-command-group
      type: depends_on
    - target: cli-command-spec
      type: depends_on
    - target: cli-minor-gaps-todo
      type: depends_on
---

# CLI Command Registry — 전환 완료

## 목적 ^purpose

CLI 명령 메타데이터를 authored descriptor에서 runtime tree와 help로 파생시키는 전환을 완료하고, 최종 구조를 확정한다.

## 현재 상태

- `cli-command` 패키지가 `CommandDescriptor`, `CliCommandNode`, `executeCommand()`를 제공한다.
- 모든 command group이 descriptor-authored SSOT(Single Source of Truth)로 전환되었다.
- `index.ts`는 더 이상 명령 데이터를 직접 기술하지 않고, group file들을 조립하는 entry 역할만 수행한다.
- `spec drift`, `def help`, `def scan`, `def read`, `quality` root alias 등 모든 레거시 표면이 runtime tree 모델로 흡수되었다.

## 완료된 단계

- 모든 group file 분리와 local dead metadata 제거 완료
- handler registry를 object map/Proxy 기반으로 축소 완료
- alias surface와 legacy fallback switch 제거 완료
