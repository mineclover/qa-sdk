---
def:
  id: gate-engine-group
  tier: system
  address: def_document:v2:68630
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: gate-service
  tags: [structural, security]
  links:
    - target: gate-engine-core
      type: contains
    - target: gate-engine-aware-query
      type: contains
    - target: gate-engine-decorator
      type: contains
    - target: gate-state-model
      type: contains
    - target: gate-system
      type: depends_on
  contains: [gate-engine-core, gate-engine-decorator, gate-engine-aware-query]
sources:
  - packages/index-meta/src/gate-engine.ts
  - packages/index-meta/src/gate-aware-query.ts
  - packages/index-meta/src/invalid-ranges.ts
  - packages/index-meta/src/gate-engine.test.ts
  - packages/index-meta/src/gate-aware-query.test.ts
  - packages/demo-tests/src/index-meta/gate-engine.test.ts
  - packages/demo-tests/src/index-meta/gate-engine-sql-e2e.test.ts
  - packages/gate-service/src/lib/gate-service.ts
---

# GateEngine 그룹

## 목적 ^purpose

index-meta 패키지의 GateEngine 라이브러리. 주소 상태 자동 재계산 + Decorator 패턴 + gate-aware-query. gate-service는 계산 소유자가 아니라 캐시/HTTP 소비자 경계다.

## 구성 ^overview

- `gate-engine-core`: GateEngine 클래스의 core 계산과 AddressStateStore/AddressRangeCache 갱신.
- `gate-engine-decorator`: VersionLifecycleStore release와 EntryFlagStore flexible setFlag를 GateEngine 재계산에 연결하는 decorator.
- `gate-engine-aware-query`: gate-aware-query — 정책 해소 결과에 gate 상태를 합성하여 최종 허용 범위를 결정하는 질의 레이어.

| 문서 | 내용 |
|------|------|
| [gate-engine-core.spec.md](gate-engine-core.spec.md) | recompute, cascadeRecompute, AddressStateCacheRecord |
| [gate-engine-decorator.spec.md](gate-engine-decorator.spec.md) | DimStateSpec 외부 주입으로 gate 상태 계산 확장 |
| [gate-engine-aware-query.spec.md](gate-engine-aware-query.spec.md) | 정책 해소 + gate 상태 합성 질의 레이어 |
