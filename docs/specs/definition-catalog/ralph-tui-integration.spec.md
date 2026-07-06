---
def:
  id: ralph-tui-integration
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  type: spec
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: ralph-tui-integration
  tags: [structural, contract, external]
  links:
    - target: deterministic-label-architecture
      type: traces_to
    - target: doc-envelope
      type: depends_on
source: packages/ralph-tui-integration/src/index.ts
---

# ralph-tui-integration — ralph-tui 도구 통합

## 목적 ^purpose

ralph-tui 특화 파일 경로(`.ralph-tui/session-meta.json`)와 포맷(flat-root JSON PRD)을 격리된 adapter로 흡수하는 Layer 2 통합 라이브러리. `doc-envelope` 수집 계층에서 ralph-tui 지식을 차단한다.

## 공개 API

- `createRalphSessionAdapter` — `.ralph-tui/session-meta.json` envelope (transient 스탬프)
- `createRalphPrdJsonAdapter` / `readRalphPrdJsonSummary` / `buildRalphPrdJsonEnvelopeFromContent`
- `detectCompletedRalphPrdRecords` — ralph PRD JSON + PRD markdown 짝 완료 감지
- 상수: `RALPH_SESSION_ADAPTER_ID`, `RALPH_PRD_JSON_ADAPTER_ID`

## 허용 의존

`doc-envelope`만.
