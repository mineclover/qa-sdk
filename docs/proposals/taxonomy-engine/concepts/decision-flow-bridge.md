---
def:
  id: taxonomy-engine-decision-flow-bridge
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: interface
  aspect: decision_flow_bridge
  tier: component
  depth: specification
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: decision-flow-bridge
sources:
  - packages/taxonomy-decision-bridge/src/decision-file.ts
  - packages/taxonomy-decision-bridge/src/to-flow-schema.ts
  - packages/taxonomy-decision-bridge/src/from-flow-schema.ts
  - packages/taxonomy-decision-bridge/src/index.ts
  - packages/taxonomy-decision-bridge/__tests__/decision-file.test.ts
  - packages/taxonomy-decision-bridge/__tests__/to-flow-schema.test.ts
  - packages/taxonomy-decision-bridge/__tests__/from-flow-schema.test.ts
  - packages/cli/src/commands/decision/analyze.ts
  - packages/cli/src/commands/decision/render.ts
  - packages/cli/src/commands/decision.test.ts
---

# Decision-Flow Bridge — decision markdown과 FlowSchema 변환

> `taxonomy-decision-bridge`는 decision markdown을 사람이 읽고 편집하는 SSOT로 두고, 필요할 때 `decision-flow`의 `FlowSchema`와 `Evidence`로 변환한다. 변환은 in-memory projection이며 SQLite나 instance store에 저장하지 않는다.

## 목적 ^purpose

- taxonomy entry에 붙은 decision markdown을 `decision-flow` 분석 함수에 연결한다.
- markdown SSOT와 `decision-flow` 모델의 책임을 섞지 않는다.
- single-gate decision과 multi-gate decision을 같은 API로 분석한다.
- CLI에서 `qa-sdk decision analyze`와 `qa-sdk decision render`로 변환 결과를 확인한다.

## 패키지 경계

| 패키지 | 책임 |
|--------|------|
| `taxonomy-decision-bridge` | decision markdown parse/serialize, marker 추출, yaml lifecycle sync 판단, FlowSchema 변환 |
| `decision-flow` | FlowSchema 타입, gate 분석, core gate 식별, schema 검증 |
| `@qa-sdk/cli` | taxonomy yaml scan, decisionLink 해소, analyze/render 명령 출력 |

decision markdown은 `docs/decisions/*.md`에 저장된다. `FlowSchema`는 분석과 렌더링 시점에 생성되는 파생 모델이다.

## Decision 파일 모델

frontmatter는 최소 메타데이터만 갖는다.

```yaml
---
id: lesson-builder.layer.cue
subject: tax:lesson-builder-content:layer.cue
lifecycle: review
created: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---
```

본문은 자연어 문단에 marker를 붙여 구조를 추출한다.

| marker | 추출 대상 |
|--------|-----------|
| `^purpose` | decision 목적 또는 질문 |
| `^context` | 배경 문단 |
| `^option:<id>` | gate branch |
| `^evidence:<kind> weight=N` | `decision-flow` `Evidence` |
| `^outcome` | 승인된 decision의 outcome |
| `^phase:<phase>` | gate phase |
| `^weight:<weight>` | gate weight |
| `^depends_on:<gateId>[:kind]` | gate dependency |
| `^gate:<id>` | multi-gate 섹션 시작 |
| `^cost:<optionId>`, `^benefit:<optionId>`, `^risk:<optionId>` | option annotation |

`EvidenceKind`는 `data | rule | precedent | intuition | external`만 허용된다. 이외 kind는 evidence에서 제외된다.

## FlowSchema 변환

`toFlowSchema(decision, { sourcePath })`는 `DecisionFile`을 `FlowSchema`로 변환한다.

| DecisionFile | FlowSchema |
|--------------|------------|
| `meta.id` | `id` |
| `meta.subject` | `unit.topic` |
| `markers.purpose` | `description`, `unit.objective` |
| `markers.options[]` | single gate `branches[]` |
| `markers.gates[]` | multi gate `gates[]` |
| evidence kind 집합 | `gate.requiredEvidence` |
| `markers.dependsOn[]` | `gate.affects` |
| `markers.outcome` + `lifecycle: approved` | `outcomes` |

single-gate decision은 `markers.gates`가 비어 있을 때 사용된다. 기본 gate는 `id: "decide"`, `phase: "decide"`, `weight: "tactical"`이다. `^phase`, `^weight`, `^depends_on` marker가 있으면 single gate에도 반영된다.

multi-gate decision은 `^gate:<id>` 이후의 `^option`, `^evidence`, `^phase`, `^weight`, `^depends_on`을 해당 gate에 붙인다. `extractEvidence()`는 multi-gate evidence를 gate 순서대로 flatten한다.

## 역방향 렌더링

`toMarkdown()`과 `toMarkdownText()`는 `FlowSchema`를 `DecisionFile` 또는 markdown text로 렌더링한다. 이 기능은 CLI `decision render`와 roundtrip 테스트를 위한 projection이다. 분석 결과를 원본 decision 파일에 자동 write-back하지 않는다.

multi-gate 렌더링은 여러 gate를 `^gate:<id>` 섹션으로 출력한다. option annotation은 `extractOptionAnnotations()`로 별도 보존해 주입할 수 있다.

## CLI

```bash
qa-sdk decision analyze
qa-sdk decision analyze tax:lesson-builder-content:layer.cue
qa-sdk decision analyze --json
qa-sdk decision render
qa-sdk decision render tax:lesson-builder-content:layer.cue --out out.md
```

`analyze`는 `docs/taxonomies/*.yaml`에서 `decisionLink`가 있는 entry를 찾고, decision 파일을 parse한 뒤 `toFlowSchema()`와 `extractEvidence()`를 실행한다. 이후 `decision-flow`의 `analyzeGateStructure()`, `identifyCoreGates()`, `validateFlowSchema()` 결과를 출력한다.

`render`는 decision markdown을 `FlowSchema`로 변환한 뒤 다시 markdown으로 렌더링한다. `--out`은 단일 ref 필터가 있을 때만 파일로 쓴다.

## 지원하지 않는 것

- SQLite, DB indexing, instance store 저장
- 외부 URL fetch
- `decision-flow://` URI 해소
- `tax:` ref 기반 decisionLink 해소
- 분석 결과의 원본 decision 파일 자동 갱신
- sync 매트릭스에 FlowSchema 분석 결과를 섞는 동작

## 검증

대표 회귀 범위:

```bash
pnpm --filter taxonomy-decision-bridge test
pnpm --filter @qa-sdk/cli test decision.test
```

현재 문서화된 표면은 `decision-file`, `to-flow-schema`, `from-flow-schema`, CLI `decision analyze/render` 테스트로 증명한다.

## 관련 문서

- [[decision-sync]] — taxonomy yaml lifecycle과 decision markdown lifecycle 동기화
- [[lifecycle]] — taxonomy entry lifecycle과 `decisionLink`
- `packages/decision-flow/src/index.ts` — FlowSchema와 분석 API
