---
def:
  tier: component
  id: scope-nesting-contract-timing-test
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: domain
  tags: [testing]
  links:
    - target: scope-nesting-contract-timing
      type: verifies
source: packages/core/src/scope-nesting-timing.test.ts
---

# Contract Timing 테스트 명세

## 목적 ^purpose

계약의 준비 시점과 역방향 위임 gap이 시뮬레이션 결과에서 일관되게 드러나는지 검증한다.

## 전제 ^preconditions

- asyncNesting: feature-context의 playbook-state에 `readyAfter: "persist_load_complete"` 설정
- simResult: `simulate()` 실행 완료, pipeTrace 확정
- lateLoadGraph: form_submit → validation_result → persist_load_complete 순서 (지연)
- earlyLoadGraph: app_init → persist_load_complete → submit 순서 (정상)
- delegationGraph: submit_started → view_render + persist_complete 병렬

## 스텝 ^steps

1. lateLoadGraph로 simulate 실행 — submit이 persist load 전에 실행
2. earlyLoadGraph로 simulate 실행 — persist load 후 submit 실행
3. readyAfter 이벤트가 시뮬에 없는 graph로 실행
4. delegatesTo가 있는 binding으로 timing 검증
5. completion event가 시뮬에 없는 binding으로 검증
6. tolerateStale: true vs false로 severity 차이 확인

## 검증 ^assertions

- consume-before-ready: submit이 persist_load_complete 전에 실행 → error
- earlyLoad: persist 후 submit → error 없음
- readiness-event-missing: readyAfter 이벤트 누락 → warning, pipeId 미설정
- completion-event-missing: completionEvent 누락 → warning
- delegation-gap: staleConsumers 목록 + gapStartStep < gapEndStep
- tolerateStale: true → warning, false → error
- readinessTimeline: readyAfter 없는 계약은 readyAtStep === -1

## 변형 ^variants

### V1: override된 계약에 readyAfter

parent(readyAfter 없음) + child(override, readyAfter 있음) → child의 readyAfter가 effective

### V2: ScopeContractRef 형태의 scopeContracts

scopeContracts에 `{ contractId: "x", required: false }` 형태 사용 → normalizeContractId 동작 확인
