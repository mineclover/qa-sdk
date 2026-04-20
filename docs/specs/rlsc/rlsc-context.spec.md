---
def:
  id: rlsc-context
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: rlsc
  links:
    - target: rlsc
      type: depends_on
---

## 목적 ^purpose
RLSCDocument를 5종 목적별 LLM 프롬프트 템플릿으로 변환하여 DesignContext를 생성한다.
토큰 예산 내에서 구조 정보의 우선순위를 결정하고, 자연어 요약과 마크업을 결합한다.

## ^defines

### generateDesignContext(doc: RLSCDocument, options?: Partial\<ContextOptions>) → DesignContext

RLSCDocument를 LLM이 소비할 수 있는 DesignContext로 변환한다.

**ContextPurpose 5종**:
| purpose | 용도 |
|---------|------|
| `layout-analysis` | 구조·계층·공간 분석 (기본값) |
| `component-search` | 특정 컴포넌트 위치/역할 식별 |
| `design-generation` | 레이아웃 패턴 기반 새 디자인 생성 |
| `design-diff` | 두 시점 비교 |
| `accessibility-audit` | ARIA 역할·키보드·시각 계층 감사 |

**DesignContext 필드**:
- `purpose`: 선택한 ContextPurpose
- `summary`: 자연어 요약 (url, viewport, 가시 요소 수, 레이어 수, 면적 상위 5개 노드, 역할 분포)
- `structure`: encodeToMarkup 결과 (maxTokens × 40% 예산, 초과 시 `\n... (truncated)` 추가)
- `matrix`: gridToText 결과
- `relations`: relationsToText 결과
- `focusDetail?`: options.focus가 지정된 경우 — nodeId 문자열이면 단일 노드 상세, LayoutRect이면 영역 내 최대 10개 노드 목록
- `prompt`: 목적별 템플릿에 위 필드를 치환한 최종 프롬프트

**토큰 예산**: `maxTokens` 기본 4000. structure 섹션에 40% (≈ 16000자) 할당. 1 토큰 ≈ 4자로 추정.

**ContextOptions 기본값**: `{ purpose: "layout-analysis", sections: ["tree","grid","layers","relations"], maxTokens: 4000 }`

## ^consumes
- `types.ts` — RLSCDocument, RLSCNode, ContextOptions, DesignContext, ContextPurpose, LayoutRect
- `encoder.ts` — encodeToMarkup
- `grid.ts` — gridToText
- `layers.ts` — layersToText
- `relations.ts` — relationsToText
- `tree-utils.ts` — flattenTree
