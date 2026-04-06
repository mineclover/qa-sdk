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
    - target: cli-command-spec
      type: depends_on
---

# CLI Command Registry — 전환 계획

## 목적 ^purpose

CLI 명령 메타데이터를 authored descriptor에서 runtime tree와 help로 파생시키는 전환 계획을 유지한다.

## 현재 상태

- `cli-command` 패키지가 `CommandDescriptor`, `CliCommandNode`, `executeCommand()`를 제공한다.
- 주요 command group은 tree/runtime 경로로 전환됐다.
- `service`, `def`, `flow`, `dkg`는 descriptor-authored SSOT를 사용한다.

## 남은 단계

- 나머지 group file 분리와 local dead metadata 제거
- handler registry를 더 object map으로 축소
- alias surface(`def`, `quality`)와 `spec drift`의 runtime 흡수 여부 결정
