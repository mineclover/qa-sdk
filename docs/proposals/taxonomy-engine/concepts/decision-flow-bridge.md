<!-- status: approved (Stage 4 구현 완료, v0.11) -->

# Decision-Flow Bridge — markdown → FlowSchema 변환 어댑터

> 부채 #6 해소. 기존 `decision-flow` 패키지(14k 줄)와 `taxonomy-decision-bridge`(markdown SSOT)의 도메인 중복을 **한 방향 변환 어댑터**로 해소. 두 패키지 정체성은 분리 유지.

## 비전 ^purpose

- bridge의 단순성(사람이 markdown 직접 편집) 보존
- decision-flow의 풍부한 분석 도구(impact, time compare, core gate identification) 활용
- 둘 다 한쪽 폐기 없이 공존 — `feedback_decision-context-over-tracking` + `project_decision-flow-identity` 두 메모리 모두 부합

## 정체성 분리

| 패키지 | 역할 | 사용자 |
|--------|------|--------|
| `taxonomy-decision-bridge` | markdown 편집 + yaml↔markdown sync | 사람이 결정 진행 추적 |
| `decision-flow` | FlowSchema 정의 + instance 실행 + 분석 | 시스템이 결정 모델/분석 |

같은 도메인 "의사결정"이지만 추상화 수준 다름. 변환 어댑터로 한 방향(markdown → schema)만 다리.

## 변환 모델

### 매핑 (단순 1:1)

| markdown 마커 | FlowSchema 필드 |
|--------------|----------------|
| `meta.id` | `FlowSchema.id` |
| `meta.subject` (tax:ref) | `FlowSchema.unit.topic` |
| `^purpose` 본문 | `FlowSchema.unit.objective` |
| `^option:<id>` 각 1개 | `BranchSchema` 1건 (단일 gate 안) |
| `^evidence:<kind> weight=N` 본문 | 변환 결과 instance의 `Evidence[]` (Stage 4 미지원, 추후) |
| `^outcome` (lifecycle=approved일 때) | `FlowSchema.outcomes` 1개 |

**전제**: markdown decision 1개 → FlowSchema 1개. 단일 gate ("결정 진행")에 `BranchSchema[]`. multi-gate decision은 markdown 본문이 2개로 쪼개야 함 (현재 scope 외).

### cognitive phase / gate weight / dependency

frontmatter나 markdown에 박지 않음. 변환 시 default 채움:
- `CognitivePhase`: `decide` (단일 gate라 결정 단계로)
- `GateWeight`: `tactical` (default — 사용자가 풍부 모델 원할 시 본문 마커 `^phase:<x>` `^weight:<x>` 신설 가능, Stage 4 미지원)
- `GateDependency`: 없음 (markdown decision은 독립)

### Evidence 타입 통합

기존 `taxonomy-decision-bridge`의 `DecisionEvidence` 제거 → `decision-flow`의 `Evidence` 재사용.

| 기존 (DecisionEvidence) | 신규 (decision-flow Evidence) |
|------------------------|------------------------------|
| `kind: string` | `kind: EvidenceKind` (5 enum) |
| `weight: number` | `weight: number` |
| `text: string` | `content: string` |
| (없음) | `source: string` — 파일 path default 채움 |
| (없음) | `metadata?: Record` |

**breaking change** — bridge의 export 타입 변경. 단 영향: taxonomy-web의 DecisionPanel + CLI의 commit 메시지 builder. 모두 한 곳씩 갱신 가능.

EvidenceKind 5종(`data/rule/precedent/intuition/external`)에 markdown 마커가 맞아야 함. 기존 도그푸딩(`^evidence:precedent`)이 이미 5종 안.

## API

```typescript
// bridge에 신규
import type { FlowSchema, Evidence } from "decision-flow";

function toFlowSchema(decision: DecisionFile, opts?: { sourcePath?: string }): FlowSchema;
function extractEvidence(decision: DecisionFile, opts?: { sourcePath?: string }): Evidence[];
```

**toFlowSchema 반환 예**:
```typescript
{
  id: "lesson-builder.layer.cue",
  name: "Decision: tax:lesson-builder-content:layer.cue",
  description: "interaction(beat과의 경계) 정의 미정",  // ^purpose
  version: "1",
  gates: [{
    id: "decide",
    name: "결정",
    phase: "decide",
    weight: "tactical",
    branches: [
      { id: "cue-includes-interaction", label: "..." },
      { id: "beat-as-entry", label: "..." },
    ],
    requiredEvidence: ["data", "precedent"],  // 본문 마커에 등장한 kind만
  }],
  outcomes: decision.markers.outcome ? [{ id: "approved", label: decision.markers.outcome }] : [],
  unit: {
    topic: decision.meta.subject,
    objective: decision.markers.purpose ?? "(미정)",
    successCriteria: [],  // markdown에 없음
  },
}
```

## CLI 진입점

신규 명령 `qa-sdk decision analyze <ref>`:

```bash
qa-sdk decision analyze tax:lesson-builder-content:layer.cue
# 출력:
#   Decision: tax:lesson-builder-content:layer.cue
#     lifecycle: review
#     branches: 2 (cue-includes-interaction, beat-as-entry)
#     evidence: 3 (data:1, precedent:2)
#   Analysis (decision-flow):
#     core gates: 1 / 1 (전체 gate가 core)
#     evidence coverage: required=[data,precedent] satisfied=[data,precedent] ✓
#     ...
```

내부 흐름:
1. `qa-sdk decision sync` 와 동일한 ref 해소 (yaml entry → decision 파일)
2. `parseDecisionFile` + `toFlowSchema` + `extractEvidence` 변환
3. decision-flow의 분석 함수 호출 (`analyzeGateStructure`, `identifyCoreGates` 등)
4. 결과 출력

`--json` 옵션 — schema + analysis 결과 JSON.

**in-memory만**. SQLite 저장 안 함. markdown(git)이 SSOT.

## 비-목표

- decision-flow → markdown 역방향 변환 (분석 결과를 markdown 본문으로 안 씀)
- multi-gate markdown (한 markdown 안 여러 결정 — scope 외)
- frontmatter에 phase/weight/dependency 박기 (단순 유지)
- SQLite 영속 (markdown=SSOT 유지)
- bridge의 sync 매트릭스에 schema 통합 (sync는 lifecycle/markers만)

## 다른 개념과의 관계

- [[decision-sync]] — sync는 lifecycle/markers, analyze는 schema 변환
- [[lifecycle]] — schema의 gate.phase는 lifecycle과 무관 (lifecycle은 결정 진행도, phase는 인지 단계)
- decision-flow `FlowSchema` — 변환 결과 타입
- decision-flow `Evidence` — 재사용

## 참조

- decision-flow: `packages/decision-flow/src/index.ts`
- bridge 현재 모델: `decision-sync.md`
- 메모리: `project_decision-flow-identity`, `feedback_decision-context-over-tracking`, `reference_gstack-decision-patterns`
- v0.11 plan: `../plans/v0.11.md`
