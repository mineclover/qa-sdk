---
def:
  id: definition-data-source
  tier: system
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  type: spec
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: definition-data-source
  tags: [contract, mediation]
  links:
    - target: definition-service-system
      type: depends_on
  source: packages/definition-data-source/src/index.ts
---

# definition-data-source — DefDataSource 팩토리

## 목적 ^purpose

`DefDataSource` 인터페이스의 팩토리 — 로컬 SQLite 파일 존재 여부와 `--server` 플래그를 감지해 SQLite 직접 접근 모드 또는 definition-service HTTP 모드를 자동 선택한다. CLI의 `def` 명령군이 두 경로에 동일한 API로 접근할 수 있도록 추상화한다.
