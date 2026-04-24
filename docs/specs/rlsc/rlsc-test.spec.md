---
def:
  id: rlsc-test
  tier: system
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: rlsc
  links:
    - target: rlsc-encoder-test
      type: contains
    - target: rlsc-relations-test
      type: contains
    - target: rlsc-grid-test
      type: contains
    - target: rlsc-query-test
      type: contains
    - target: rlsc-context-test
      type: contains
    - target: rlsc-monitor-test
      type: contains
    - target: rlsc-metrics-test
      type: contains
    - target: rlsc-pattern-test
      type: contains
    - target: rlsc-intent-test
      type: contains
    - target: rlsc-canvas-test
      type: contains
    - target: rlsc
      type: depends_on
---

## 목적 ^purpose

rlsc 패키지 전체 테스트 범위 인덱스. 10개 모듈의 단위·시나리오 테스트 문서를 contains 관계로 집계한다.

소스: `packages/rlsc/src/`

## 테스트 파일 목록

| 파일 | 문서 | 커버리지 |
|------|------|----------|
| `encoder.test.ts` | `rlsc-encoder-test` | 라운드트립, 이스케이프, addr 직렬화, relations 섹션 |
| `relations.test.ts` | `rlsc-relations-test` | 기하 경계 8종, contains 우선순위 |
| `grid.test.ts` | `rlsc-grid-test` | cellSize 기본값, dominant, coverage, zStack |
| `query.test.ts` | `rlsc-query-test` | 조건 필터 4종, diff 5종 |
| `context.test.ts` | `rlsc-context-test` | 토큰 예산 truncate, {layers} 버그 수정 검증 |
| `monitor.test.ts` | `rlsc-monitor-test` | 브라우저 가드, debounce (3 tests) |
| `metrics.test.ts` | `rlsc-metrics-test` | 8종 측정 함수 + 통합 (25 tests) |
| `pattern.test.ts` | `rlsc-pattern-test` | classifyLayout 전 필드 (23 tests) |
| `intent.test.ts` | `rlsc-intent-test` | checkConformance + score 계산 (9 tests) |
| `canvas.test.ts` | `rlsc-canvas-test` | assignColors + renderToSVG + 브라우저 가드 (15 tests) |
