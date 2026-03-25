---
def:
  id: address-scenarios-runtime
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  tags: [testing]
  links:
    - target: address-spec
      type: traces_to
    - target: address-scenarios
      type: refines
---

# Address 시나리오 - 런타임 프로토콜 관리

## 목적 ^purpose

런타임 프로토콜 lifecycle 관리와 schema-only consumer 시나리오를 정리해 주소 체계가 완전한 직렬화 없이도 소비되는 경로를 설명한다.

## 런타임 lifecycle

- 프로토콜 관리는 address format이 진화해도 소비자가 단계적으로 따라올 수 있게 versioned runtime contract를 제공해야 한다.
- schema-only consumer는 직렬화까지 소유하지 않아도 구조만 읽어 동작할 수 있어야 한다.
- 이런 소비자는 registry snapshot과 runtime protocol 사이의 얇은 호환 계층이 핵심이다.

## 시나리오 맵

- 외부 시스템 통합은 parse -> lifecycle management -> schema-only consumer 순서로 이어진다.
- 어느 단계에서든 protocol mismatch가 발견되면 명시적으로 downgrade하거나 재동기화해야 한다.
- 파싱 경계는 `address-scenarios-parse`, 구조/프로토콜 경계는 이 문서가 맡는다.
