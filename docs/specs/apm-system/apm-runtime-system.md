---
def:
  id: apm-runtime-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: runtime-flow-paths
      type: contains
    - target: runtime-flow-rollout
      type: contains
    - target: logger-contract
      type: contains
    - target: logger-runtime-rules
      type: contains
---

# APM 런타임 그룹

## 목적 ^purpose

운영 중 관측 경로와 로거 계약을 동기/비동기 흐름, 도입 순서, 설정/제약 문서로 나눠 런타임 변경 범위를 줄인다.

## 구성 ^overview

overview: 총 4개 멤버.
- `runtime-flow-paths`: 동기, 비동기, 디버깅 경로와 내부 참여 모듈을 정리한 문서.
- `runtime-flow-rollout`: 구현 현황, 도입 순서, 운영 중 빠른 참조 규칙을 정리한 문서.
- `logger-contract`: QaLogger의 인터페이스, 설정, 파라미터 계약을 정리한 문서.
- `logger-runtime-rules`: 로거의 동작 제약과 테스트 커버리지 기준을 정리한 문서.

원본: `docs/specs/operations/runtime-flows.spec.md` (`runtime-flows-spec`), `docs/specs/collection/logger.spec.md` (`logger-spec`)
