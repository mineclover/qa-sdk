---
def:
  id: sdk-scenario-entry-modes
  level: leaf
  scope: feature
  aspect: scenario
  depth: validation
  svc: index-meta
  lifecycle: approved
  layer: domain
  tags: [testing]
  links:
    - target: sdk-scenarios
      type: refines
    - target: sdk-system
      type: traces_to
---
# SDK 시나리오 — 엔트리 제공 모드

## 목적 ^purpose

프론트엔드용 Client 모드와 백엔드용 Full 모드가 다른 수준의 엔트리 정보를 노출하면서도 동일한 스키마 의미를 유지함을 검증한다.

## 구성 ^overview

- Client 모드: `entries()`, `constants()`
- Full 모드: `dimFullView()`, `dimCapacity()`
- reserved / normal / empty 3분류
- headroom과 capacity 분석

## 검증 포인트

- Client 모드에는 capacity/headroom이 노출되지 않음
- Full 모드에는 전체 capacity와 position kind가 노출됨
- 관리 UI/DB range scan 계획에 Full 모드가 사용 가능
