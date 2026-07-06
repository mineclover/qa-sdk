---
def:
  id: pipe-path
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: pipe-types
      type: depends_on
    - target: ms-concept-branch-path
      type: implements
source: packages/core/src/pipe/pipe-path.ts
---

# 분기 경로 수 계산

## 목적 ^purpose

PipeFlow에서 도달 가능한 분기 경로 수를 계산한다.
전곱이 아닌 경로 합산 모델: sequence→곱, branch→합, optional→+1.
단일 파이프 내부(`countPipePaths`)와 그래프 전체(`countGraphPaths`) 모두 지원.

## 관련 소스

- `packages/core/src/pipe-path.ts` — countPipePaths, countGraphPaths
- `packages/core/src/pipe-path.test.ts` — 35 테스트

## 계산 규칙 요약

| kind | 계산 | 이유 |
|------|------|------|
| step | 1 | 단일 |
| sequence | Π | 순차→곱 |
| branch | Σ | 조건부→합 |
| optional | +1 | 있는/없는 경로 |
| parallel | Π | 전부→곱 |
| race | Σ | 하나만→합 |
| fallback | try+catch | 성공+대안 |
| compensate | forward+undo | 정상+보상 |
| filter/dedup | +1 | 통과+소멸 |
| circuit-breaker | +1 | 정상+차단 |
| timeout | body+onTimeout | 정상+타임아웃 |
| correlation | match+timeout | 매칭+타임아웃 |
| 나머지 | inner 경로 | 반복/래핑은 내부 경로만 |

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe-path.test.ts
```
