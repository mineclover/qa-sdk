---
def:
  id: rlsc-context-test
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: rlsc
  links:
    - target: rlsc-context
      type: refines
  source: packages/rlsc/src/context.test.ts
---

## 목적 ^purpose

`generateDesignContext`의 토큰 예산 트런케이션, 템플릿 치환, sections 필터링, 반환 필드를 검증한다.

소스: `packages/rlsc/src/context.test.ts`

## 토큰 예산

| 시나리오 | 기대 결과 |
|----------|----------|
| `maxTokens: 10` (극소) | `ctx.structure`에 `"(truncated)"` 포함 |
| `maxTokens: 10000` (충분) | `ctx.structure`에 `"(truncated)"` 없음 |

## accessibility-audit 템플릿

| 시나리오 | 기대 결과 |
|----------|----------|
| `purpose: "accessibility-audit"` | `ctx.prompt`에 `"{layers}"` 리터럴 없음 (치환 완료) |
| `purpose: "accessibility-audit"` + layers에 role "background" 포함 | `ctx.prompt`에 `"background"` 텍스트 포함 |

## sections 필터링

| 시나리오 | 기대 결과 |
|----------|----------|
| `sections: ["tree"]` | `ctx.matrix === ""` (grid 섹션 미생성) |
| `sections: ["grid"]` | `ctx.structure === ""` (tree 섹션 미생성) |

## 기본 반환값

| 시나리오 | 기대 결과 |
|----------|----------|
| 기본 옵션 | `ctx.summary`에 url 포함 |
| 기본 옵션 | `ctx.summary`에 viewport width/height 포함 |
| purpose 미지정 | `ctx.purpose === "layout-analysis"` |
