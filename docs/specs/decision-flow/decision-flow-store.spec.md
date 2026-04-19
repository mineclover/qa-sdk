---
def:
  id: decision-flow-store
  type: spec
  level: leaf
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: decision-flow-store
  tags: [persistence, sqlite]
  links:
    - target: df-system
      type: refines
  source: packages/decision-flow-store/src/index.ts
---

# decision-flow-store — InstanceStore SQLite 구현

## 목적 ^purpose

`decision-flow` 라이브러리의 `InstanceStore` 포트를 SQLite(`node:sqlite` + drizzle)로 영속화하는 어댑터. 결정 인스턴스·evidence·transition 이력을 로컬 파일로 저장해 CLI 재실행 간 상태를 유지한다. 순수 라이브러리인 `decision-flow`는 영속 상세를 몰라 테스트가 InMemory로 대체 가능하다.
