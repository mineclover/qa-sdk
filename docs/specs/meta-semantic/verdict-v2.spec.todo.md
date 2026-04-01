---
def:
  id: verdict-v2
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: domain
  links:
    - target: meta-semantic-v2-migration
      type: depends_on
    - target: path-matcher-migration
      type: depends_on
    - target: meta-semantic-scope
      type: depends_on
---

# VerdictReport v1 → v2 전환

## 목적 ^purpose

VerdictReport를 ScenarioSpec 기반 6상태 판정에서
scope×aspect 검증 전략 기반 판정으로 전환한다.
PathMatcher 전환이 선행 조건이다.

## 할 일

- [ ] VerdictReport v2 타입 정의 (scope×aspect 검증 전략 기반)
- [ ] PathMatcher 결과 → VerdictReport v2 변환 함수
- [ ] scope별 검증 전략 매핑 (meta-semantic-scope §4 테이블 코드화)
- [ ] v1 → v2 변환 어댑터 (기존 데이터 호환)
- [ ] 기존 VerdictReport 소비자 전환 (query-service, CLI 등)
- [ ] v1 코드 제거

## 현재 상태

- VerdictReport v1: `core/src/types/verdict.ts` (6상태: pass/fail/warn/degraded/unknown/skipped)
- PathMatcher: `core/src/path-matcher.ts` (8 tests, 경로 모델 기반 판정)
- scope×aspect 검증 전략: `meta-semantic-scope.spec.md` §4에 테이블 정의 (코드 미구현)

## v2 판정 모델 (안)

| 구성 | 설명 |
|------|------|
| scope + aspect | 검증 전략 결정 키 |
| strategy | 해당 scope×aspect 조합의 검증 방법 |
| pathResult | PathMatcher 경로 매칭 결과 |
| gateResults | PipeGate 평가 결과 |
| verdict | pass / fail / review (3종, 6상태에서 축소) |

## 의존 순서

```
path-matcher-migration (선행)
  → verdict-v2 (후행)
    → compat 정리 (VerdictReport v1 제거)
```

## 위험

- v1 소비자가 6상태에 의존하는 경우 → 3상태로 매핑 규칙 필요
- scope×aspect 전략 테이블의 완성도 → meta-semantic-scope §4 검토 필수
