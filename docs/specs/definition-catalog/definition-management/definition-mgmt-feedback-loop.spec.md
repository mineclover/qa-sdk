---
def:
  id: definition-mgmt-feedback-loop
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [observability, decision]
  sources:
    - packages/definition-catalog/src/cross-loop-bridge.ts
    - packages/definition-catalog/src/cross-loop-bridge.test.ts
    - packages/definition-catalog/src/harness-tracker.ts
    - packages/definition-catalog/src/bridge.ts
  links:
    - target: definition-management
      type: refines
    - target: definition-cross-loop-bridge
      type: depends_on
    - target: review-ledger-spec
      type: depends_on
    - target: harness-architecture
      type: depends_on
---

# Definition Management — 피드백 루프

## 목적 ^purpose

관측, feedback request, decision, infra 전이가 definition 문서를 다시 갱신하는 순환 구조를 정리한다. feedback이 메모로 끝나지 않고 문서/결정 루프에 편입되는 경로를 설명한다.

## 구성 ^overview

- Gate → Harness
- Harness → Decision
- Decision → Infra
- FeedbackRequest → Decision
- Infra → User
- ingest/convergence → Observation

## 6개 피드백 루프

```text
① 사용자 행동 → ④ 수렴 분석 → ⑥ 인프라 관측
      ↑                                ↓
② 상태 머신 ← ③ 품질 게이트 ← ⑤ 의사결정
```

| 연결 | 브릿지 | 좌표 |
|------|--------|------|
| ③→② Gate→Harness | `createGateHarnessBridge()` | bundle complete → convention compliant |
| ②→⑤ Harness→Decision | `buildHarnessContext()` | 머신 상태 → 의사결정 컨텍스트 |
| ⑤→⑥ Decision→Infra | `createDecisionInfraBridge()` | verdict → doc lifecycle 전이 |
| 리뷰→⑤ Feedback→Decision | `FeedbackRequest` + `review bridge-request` | evidence bundle → DKG observation/prompts |
| ⑥→① Infra→User | `gateFilterRanges("encodable")` | gate 상태 → encode 차단 |
| ①→④ 자동 | HTTP ingest → convergence pipeline | 레코드 → 패턴/메트릭 |

## 관측 좌표 커버리지

```text
전체 prefix: 63개
관측 prefix: 33개
카테고리: navigation, interaction, form, session, network,
          execution, outcome, quality, infrastructure
```

## FeedbackRequest의 역할

- 코드/파일 상태를 `EvidenceBundle`로 묶는다.
- relatedDocs로 definition 문서와 연결된다.
- 선택 시 DKG observation/decision으로 브릿지된다.
- `def get/context/impact/bottomup/incoming`에서 synthetic trace로 재노출된다.
