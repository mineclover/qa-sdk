---
def:
  tier: component
  id: scope-nesting-simulation-layers-test
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: domain
  tags: [testing]
  links:
    - target: scope-nesting-simulation-layers
      type: verifies
source: packages/core/src/scope-nesting-simulate.test.ts
---

# 시뮬레이션 계층 테스트 명세

## 목적 ^purpose

L0 guard부터 L3 simulate까지 5계층 시뮬레이션 모델이 같은 전제와 결과로 연결되는지 검증한다.

## 전제 ^preconditions

- guards: SimulationGuards 3필드 각각 독립 주입 가능
- 미주입 시 fail-open (isEncodable=true, gateResult=pass, harnessState=active)
- fullNesting + handlerGraph + mountBinding 조합

## 스텝 ^steps

1. L0 미주입 → L1~L3 전부 통과 (fail-open 기본 시퀀스)
2. isEncodable false → L1 guard-inactive, L1.5 contract-unavailable(optional=warning), L3 무영향
3. L1.5↔L3 교차: timing delegation gap + tolerateStale
4. resolveContracts로 handler provider 추적

## 검증 ^assertions

- guard 미주입 = 빈 객체 = 기본값 동작
- isEncodable 영향: L1/L1.5에만 반영, L3 simulate는 독립
- optional mount contract → severity warning (error 아님)
- resolveContracts: provider.scopeId가 예상 scope와 일치
