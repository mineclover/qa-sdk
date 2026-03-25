---
def:
  id: gate-engine-group
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  contains: [gate-engine-core, gate-engine-decorator, gate-engine-aware-query]
  links:
    - target: gate-state-model
      type: depends_on
---
# GateEngine 그룹

## 목적 ^purpose

index-meta 패키지의 GateEngine 라이브러리. 주소 상태 자동 재계산 + Decorator 패턴 + gate-aware-query.

## 구성 ^overview

3개: GateEngine 코어(recompute/cascade), Decorator(DimStateSpec 주입), gate-aware-query(정책 합성).

| 문서 | 내용 |
|------|------|
| [gate-engine-core.spec.md](gate-engine-core.spec.md) | recompute, cascadeRecompute, AddressStateCacheRecord |
| [gate-engine-decorator.spec.md](gate-engine-decorator.spec.md) | DimStateSpec 외부 주입으로 gate 상태 계산 확장 |
| [gate-engine-aware-query.spec.md](gate-engine-aware-query.spec.md) | 정책 해소 + gate 상태 합성 질의 레이어 |
