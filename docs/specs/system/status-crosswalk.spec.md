---
def:
  id: status-crosswalk
  type: knowledge
  knowledge_kind: concept
  tier: component
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [cross-scope, structural, entry-point]
  links:
    - target: taxonomy-boundaries
      type: traces_to
    - target: pm-taxonomy-plan
      type: traces_to
    - target: definition-mgmt-state-tracking
      type: depends_on
    - target: df-state-model
      type: depends_on
    - target: infra-engine-pipeline
      type: depends_on
    - target: infra-observe-stage
      type: depends_on
    - target: decision-definition-bridge
      type: traces_to
---

# Status Crosswalk — 상태 체계 번역표

## 목적 ^purpose

qa-sdk에 공존하는 여러 상태 체계를 하나로 합치지 않고, 각 체계의 소유권을 유지한 채 해석 가능한 번역표를 제공한다. 이 문서는 책임 분리 이후의 **초안 해석 레이어**이며, 특히 PM taxonomy가 아직 draft인 동안에는 제안 vocabulary를 임시 번역하는 목적을 가진다.

## 정의 ^defines

- 상태 소유권 규칙
- process status / outcome verdict / document lifecycle / deploy stage / runtime health의 구분
- 시스템 간 기본 번역표
- 자동 매핑과 금지 매핑

## 구성 ^overview

| 상태 체계 | 소유 시스템 | 질문 | 대표 필드 |
|---|---|---|---|
| PM 상태(초안) | PM taxonomy plan | 이 일은 누가 언제까지 어디까지 진행했는가 | `process_status`, `outcome_verdict` |
| 문서 상태 | definition-catalog | 이 문서는 어떤 생명주기에 있는가 | `lifecycle`, harness machine state |
| 판단 상태 | decision-flow | 이 판단 과정은 진행 중인가, 결론은 무엇인가 | `FlowStatus`, `DecisionVerdict` |
| 배포 상태 | infra-engine | 이 배포 실행은 어떤 단계 결과를 냈는가 | `StageResult.status`, `gateVerdict` |
| 운영 건강 상태 | infra observe | 서비스가 현재 건강한가 | `health_status` |

## 상태 소유권 ^constraint

1. PM taxonomy가 승인되기 전까지 `process_status`와 `outcome_verdict`는 **제안 vocabulary**다.
2. definition-catalog만 문서 `lifecycle`를 소유한다.
3. decision-flow만 판단 과정의 `FlowStatus`와 결론 `DecisionVerdict`를 소유한다.
4. infra-engine만 배포 단계의 `StageResult.status`와 `gateVerdict`를 소유한다.
5. 운영 건강도는 `health_status`가 소유하며, PM/decision/document 상태를 직접 대체하지 않는다.
6. crosswalk는 읽기용 해석 레이어다. 원본 상태를 덮어쓰지 않는다.

## 핵심 구분

### 1. Process Status

일/산출물의 진행 상태.

예:
- `proposed`
- `planned`
- `active`
- `blocked`
- `review`
- `verified`
- `closed`

### 2. Outcome Verdict

결과적 판정.

예:
- `success`
- `failure`
- `deferred`
- `superseded`

### 3. Document Lifecycle

문서 생명주기.

예:
- `draft`
- `review`
- `approved`
- `deprecated`
- `archived`

### 4. Deploy Stage Status

배포 파이프라인 내부 단계 결과.

예:
- `success`
- `failed`
- `skipped`
- `rolled_back`

### 5. Runtime Health

운영 건강 상태.

예:
- `healthy`
- `degraded`
- `unhealthy`
- `maintenance`

## 기본 번역표 ^method

### decision-flow verdict → definition lifecycle

이 매핑만은 코드 구현이 존재하므로 **자동 매핑**으로 취급한다.

| `DecisionVerdict` | `DefLifecycle` |
|---|---|
| `success` | `approved` |
| `failure` | `deprecated` |
| `deferred` | `draft` |
| `superseded` | `archived` |

### decision-flow process → PM process (초안)

이 매핑은 **권장 읽기**이며 자동 확정이 아니다. PM taxonomy가 spec으로 승격되기 전까지는 vocabulary 안정성도 보장하지 않는다.

| `FlowStatus` | 권장 `process_status` 해석 |
|---|---|
| `pending` | `planned` 또는 `proposed` |
| `active` | `active` |
| `blocked` | `blocked` |
| `abandoned` | `closed` 후보 |
| `completed` | `review` 또는 `verified` 후보 |

주의:
- `completed`는 과정 종료를 뜻할 뿐 결과 성공을 뜻하지 않는다.
- `completed` 이후에도 `DecisionVerdict`가 없으면 `closed`로 확정하지 않는다.

### infra deploy → PM process

infra 상태는 PM 상태의 **증거**이지 직접 등치되는 값이 아니다.

| infra 필드 | 의미 | PM에서의 사용 |
|---|---|---|
| `StageResult.status` | 단계별 실행 결과 | 진행 근거 / 실패 원인 |
| `gateVerdict` | 배포 검증 판정 | verification evidence |
| `health_status` | 배포 후 운영 건강도 | 운영 상태 evidence |

권장 읽기:
- `gateVerdict=pass` + `health_status=healthy` → `verified` 근거 강화
- `StageResult.status=failed` 또는 `rolled_back` → `blocked` 또는 `closed(failure)` 후보
- `health_status=degraded/unhealthy` → 완료 후에도 `verified` 확정 보류 가능

## 금지 규칙

- 문서 `lifecycle=approved`만으로 PM item을 `closed`로 간주하지 않는다.
- `FlowStatus=completed`만으로 결과를 `success`로 간주하지 않는다.
- `health_status=healthy`만으로 배포 작업을 완료로 간주하지 않는다.
- `gateVerdict=pass`만으로 문서 lifecycle을 자동 변경하지 않는다. lifecycle 변경은 명시적 bridge나 운영 규칙을 따라야 한다.

## 관련 소스

- `docs/specs/definition-catalog/definition-management/definition-mgmt-state-tracking.spec.md`
- `docs/specs/decision-flow/df-model-group/df-state-model.spec.md`
- `docs/specs/infra-engine/infra-engine-pipeline.spec.md`
- `docs/specs/infra-engine/infra-observe-stage.spec.md`
- `packages/definition-catalog/src/bridge.ts`
