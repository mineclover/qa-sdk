---
def:
  id: verdict-v2
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-v2-migration
      type: depends_on
    - target: meta-semantic-scope
      type: depends_on
  source: packages/core/src/pipe/verdict-v2.ts
---

# VerdictReport v2 — PipeGraph 기반 판정

## 목적 ^purpose

PathMatcher의 MatchResult + PipeGate의 GateResult를 결합하여
PipeGraph 기반 pass/fail/review 3종 판정을 생성한다.
v1(ScenarioSpec 6상태)을 대체하는 PipeGraph 우선 판정 모델.

## 정의 ^defines

- `VerdictV2` — 3종 판정 (pass/fail/review)
- `VerdictReportV2` — 그래프·매칭·게이트·커버리지·사유 통합 리포트
- `FacetCoverage` — 패싯 단위 검증 커버리지
- `computeVerdictV2()` — PathMatcher + PipeGate → VerdictReportV2

## 소비 ^consumes

- `MatchResult` (path-matcher.ts) — 파이프 매칭 결과
- `GateResult`, `allGatesPass`, `hasReviewItems` (pipe-gate.ts) — 게이트 평가
- `PipeGraph`, `PipeFlow` (pipe-spec.ts) — 패싯 수집

## 완료

- [x] VerdictReportV2 타입 — graphId, verdict, scope/aspect, pipeCoverage, facetCoverage
- [x] computeVerdictV2(match, graph, gateResults?) — 판정 함수
- [x] 3종 판정 규칙:
  - fail: 실행 에러 / 커버리지 < 50% / 게이트 fail
  - review: 미실행 파이프 / unexpected steps / 게이트 review
  - pass: 전체 매칭 + 게이트 통과
- [x] 패싯 커버리지 — PipeFlow 트리 순회로 전체 패싯 수집
- [x] summary 생성 — 판정·파이프%·패싯%·에러·게이트 요약
- [x] 테스트 13건 통과

## 관련 소스

| 파일 | 역할 |
|------|------|
| `core/src/verdict-v2.ts` | 구현 |
| `core/src/verdict-v2.test.ts` | 테스트 (13 tests) |

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/verdict-v2.test.ts  # 13 tests
```
