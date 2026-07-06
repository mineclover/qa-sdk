---
def:
  id: pipe-static-lineage-test
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: domain
  links:
    - target: pipe-static-lineage
      type: verifies
    - target: test-name-tokens
      type: depends_on
source: packages/core/src/pipe/pipe-lineage-consistency.test.ts
---

# 정적 계보 추적 — 검증 기준

## 목적 ^purpose

정적 계보 추적이 sequence, graph, serialization 경로에서 같은 lineage semantics를 유지하는지 검증한다.

## 대응 테스트 파일

- `packages/core/src/pipe/pipe-lineage.test.ts`
- `packages/core/src/pipe/pipe-lineage-consistency.test.ts`

## 시나리오

### S-001: 양쪽 기여 계보

- **describe**: `정적 계보 파생 — deriveStaticLineage`
- **it**: `a + b → c (양쪽 기여) — c의 계보에 a, b 포함`
- **전제**: lineageHints에 sources: ["a", "b"]
- **기대**: c의 계보에 a, b 모두 포함

### S-002: 소비 구분

- **describe**: `정적 계보 파생 — deriveStaticLineage`
- **it**: `a만 통과, b 소비 — c의 계보에 a만 포함`
- **전제**: lineageHints에 sources: ["a"] (b 미포함)
- **기대**: c의 계보에 a만, b 제외

### S-003: sequence 체인 추적

- **describe**: `정적 계보 — sequence 체인`
- **it**: `A.produces → B.consumes → B.produces 체인 추적`
- **전제**: 2-step sequence, 각 step에 lineageHints
- **기대**: step 내부 계보 + step 간 chain 계보

### S-004: flow 레벨 계보 압축

- **describe**: `flow 계보 요약 — summarizeFlowLineage`
- **it**: `3단계 sequence: rawOrder → validatedOrder → paymentResult — 최종 계보 압축`
- **기대**: outputLineage.paymentResult = ["rawOrder"] (중간 생략)

### S-005: 소비 전파 — 다단계

- **describe**: `flow 계보 요약 — summarizeFlowLineage`
- **it**: `a 통과 + b 소비 → c, c → d — 최종 d의 계보 [a] (b 제외)`
- **기대**: d ← [a], b는 전체 chain에서 제외

### S-006: 컬럼명 충돌 안전

- **describe**: `정적 계보 — 컬럼명 충돌`
- **it**: `두 step이 같은 이름 'result' 생산 — 서로 간섭하지 않음`
- **전제**: step A produces result, step B produces result (다른 의미)
- **기대**: schemaId 복합키로 분리됨

### S-007: chain 경계 횡단

- **describe**: `정적 계보 — chain 경계 횡단 증명`
- **it**: `필드명이 매 step마다 변하는 3단계 — chain record로만 횡단 가능`
- **기대**: y의 origin = [x] (chain record 경유)

### S-008: 실전 시나리오 — 주문처리

- **describe**: `정적 계보 — 주문처리 실전 시나리오`
- **it**: `주문접수(rawOrder+customerId) → 결제 → 배송 — customerId 소비 증명`
- **기대**: trackingId ← [rawOrder, shippingAddress], customerId 제외

### S-009: 정적 ↔ 시뮬 교차 일관성

- **describe**: `정적 ↔ 시뮬 교차 일관성` (pipe-lineage-consistency.test.ts)
- **기대**: 같은 입력에 양쪽 경로의 (target.column, sources[].column, transform) 집합 일치
- **케이스**: 단일 step, 2-step chain, 소비 구분, transition-scope, hints 없음

### S-010: findFieldOrigin 단일 진입점

- **describe**: `findFieldOrigin`
- **기대**: fieldName만으로 최종 입력까지 역추적 (schemaId 자동 해석)

### S-011: graph-level cross-pipe 계보

- **describe**: `deriveGraphLineage`
- **기대**: PipeConnection 기반 cross-pipe chain 생성

### S-012: 직렬화 라운드트립 + diff

- **describe**: `계보 직렬화`
- **기대**: serialize → deserialize 동등, diffLineage로 변경 감지
