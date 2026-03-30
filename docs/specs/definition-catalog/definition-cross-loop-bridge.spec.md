---
def:
  id: definition-cross-loop-bridge
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [cross-scope, runtime, decision, observability]
  links:
    - target: harness-architecture
      type: implements
    - target: definition-harness
      type: depends_on
---

## 목적 ^purpose

6개 피드백 루프가 독립적으로 동작하면 시스템 전체의 상태 전파가 끊어진다. 이 모듈은 루프 간 "연결 조직"으로, 한 루프의 출력이 다른 루프의 입력이 되도록 브릿지한다.

## 사용 맥락 ^context

CLI(`qa-sdk quality`)나 서비스가 게이트 실행 후 결과를 하네스에 반영할 때, 의사결정 완료 후 문서 lifecycle을 전이할 때 사용한다. 각 브릿지는 독립적으로 사용 가능하며, 전체를 연결하면 순환 피드백이 완성된다.

## 3개 브릿지

### createGateHarnessBridge (③→②)

BundleState `complete` → convention-compliance `compliant` 자동 전이. guard 의존(`doc-lifecycle: approved` 필요)을 존중하며, guard 위반 시 경고만 발생.

### buildHarnessContext (②→⑤)

하네스 머신 상태를 `HarnessContextSnapshot`으로 변환. `overallHealth`(healthy/warning/critical)와 `warnings` 배열을 ContextProvider context에 주입하여 의사결정 컨텍스트를 풍부하게 한다.

### createDecisionInfraBridge (⑤→⑥)

의사결정 verdict → `suggestLifecycleFromVerdict()` → doc-lifecycle 전이 시도. 전이 불가 시 경고만. FlowEngine listener 패턴으로 연결.

## 주의사항 ^caveat

- guard 순서: Decision success → Doc approved → Gate complete → Convention compliant. 순서 위반 시 전이 실패하지만 시스템은 중단되지 않음 (fail-open)
- cascade 격리: 브릿지 전이 실패가 원본 동작을 롤백하지 않음

## 관련 소스

- `definition-catalog/src/cross-loop-bridge.ts`
- `definition-catalog/src/cross-loop-bridge.test.ts` — 15건 (시나리오 4 + 엣지 5 + 통합 1)
