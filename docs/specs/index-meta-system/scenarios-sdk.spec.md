---
def:
  id: sdk-scenarios
  tier: layout
  scope: feature
  aspect: scenario
  depth: overview
  svc: index-meta
  lifecycle: approved
  layer: domain
  tags: [testing]
  links:
    - target: resolver-spec
      type: traces_to
    - target: sdk-system
      type: traces_to
    - target: sdk-scenario-lifecycle
      type: refs
    - target: sdk-scenario-entry-modes
      type: refs
    - target: sdk-scenario-schema-evolution
      type: refs
    - target: sdk-scenario-multi-service
      type: depends_on
    - target: sdk-scenario-cli-simulation
      type: refs
    - target: sdk-scenario-inactive-entries
      type: refs
    - target: sdk-scenario-reserved-tokens
      type: refs
---

# SDK 라이프사이클 유저 시나리오

## 목적 ^purpose

IndexSDK 기반 클라이언트·서버 운영 시나리오를 단계별로 분리해 관리한다. SDK 소비, entry 제공 모드, 스키마 진화, 멀티 서비스 공유, CLI 시뮬레이션, inactive 항목 운영, reservedTokens 오버라이드의 검증 맥락을 모듈로 묶는다.

## 구성 ^overview

- `sdk-scenario-lifecycle`: SDK 소비 라이프사이클 전체 경로
- `sdk-scenario-entry-modes`: Client vs Full 엔트리 제공 모드
- `sdk-scenario-schema-evolution`: 스키마 진화와 SDK 동기화
- `sdk-scenario-multi-service`: 멀티 서비스 스키마 공유
- `sdk-scenario-cli-simulation`: CLI 출력 재현 시나리오
- `sdk-scenario-inactive-entries`: inactive/deprecated entry 운영
- `sdk-scenario-reserved-tokens`: reservedTokens 오버라이드

## 테스트 범위

- E2E 시나리오 30건
- SDK 단위 테스트 77건
- 총 107개 테스트

## 참조

- Core 시나리오: `user-scenarios`
- SDK 스펙: `sdk-system`
- Resolver 번들 규칙: `resolver-spec`
