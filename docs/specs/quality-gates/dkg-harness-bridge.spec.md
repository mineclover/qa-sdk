---
def:
  id: dkg-harness-bridge
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: approved
  layer: mediation
  tags: [cross-scope]
  links:
    - target: quality-gates-system
      type: refines
    - target: dkg-skills-system
      type: depends_on
    - target: harness-state-model
      type: depends_on
---

## 탐색 ^navigation

quality-gates-system > **dkg-harness-bridge**

형제: `quality-ledger` · `harness-state-model` · `harness-model`

## 목적 ^purpose

DKG skill 실행 결과와 하네스 품질 게이트 사이의 연결을 정의한다. DKG analysis skill은 구조적 문제를 발견하고, 그 발견이 하네스 상태 전이와 품질 게이트에 어떻게 영향을 주는지 명시한다.

## 연결 방향

```
DKG analysis skill (발견)
  → Observation 자동 생성
  → Decision scaffold 제안
  → 하네스 영향:
    - metric-health 상태 변경 (ok → warning/critical)
    - convention-compliance 재평가 트리거
    - gate 재실행 필요 신호
```

## skill → harness 매핑

| DKG Skill | 하네스 영향 | 메커니즘 |
|-----------|-----------|---------|
| `skill-schema-health-audit` | metric-health 상태 | 위반 → ObservationNode → metricsToObservations |
| `skill-prefix-capacity-audit` | metric-health (headroom) | headroom=0 → metric:headroom 경고 |
| `skill-gate-refentries-check` | address-state (reserved) | CON-006 위반 → 해당 position reserved |
| `skill-commerce-skew-audit` | version-lifecycle 재검토 | 스큐 탐지 → DecisionNode 제안 |
| `skill-system-health-chain` | 전체 하네스 재평가 | constraint + domain + observation 종합 |
| `skill-converge-chain` | convention-compliance | merge/deactivate → 구조 변경 → 재검증 |
| `skill-domain-health` | metric-health (도메인별) | 도메인 건강 → 해당 도메인 metric 갱신 |

## harness → DKG 매핑

| 하네스 이벤트 | DKG 반영 | 메커니즘 |
|-------------|---------|---------|
| gate pass/fail | `skill_execution` prefix 기록 | emitSkillExecution |
| bundleState=complete | convention → compliant | createGateHarnessBridge |
| doc approved | Decision context 갱신 | buildHarnessContext |
| metric critical | decision-flow blocked | 하네스 cascade (notify) |

## 현재 한계

1. **DKG skill → gate 자동 실행 없음**: skill이 문제를 발견해도 quality-ledger에 직접 기록하지 않음. 사람이 `qa-sdk quality run`으로 별도 실행해야 함
2. **gate 결과 → DKG 자동 반영 없음**: gate pass/fail이 DKG ObservationNode로 자동 생성되지 않음
3. 두 방향 모두 **수동 브릿지**: CLI를 통한 사용자 개입 필요

## 향후 자동화 경로

```
skill-system-health-chain (분석)
  → 위반 발견 시 자동 quality run 트리거
  → quality-ledger에 결과 기록
  → bundleVerification 갱신
  → harness 상태 자동 전이
  → DKG ObservationNode 자동 생성 (피드백 루프 완성)
```
