---
def:
  id: spec-todo
  type: knowledge
  knowledge_kind: guide
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [roadmap, follow-up]
  links:
    - target: wi-hardware-acceleration
      type: traces_to
    - target: indexing-pipeline
      type: traces_to
    - target: spec-engine-system
      type: depends_on
sources:
  - docs/specs/weighted-index-system/wi-hardware-acceleration.spec.md
  - docs/specs/pipeline-system/pipeline.md
  - packages/weighted-wasm/js/index.ts
  - packages/index-meta/src/index.ts
---

# 스펙별 작업 필요 사항

> 2026-04-06 기준. 완료 항목은 각 스펙에 흡수, 잔여만 추적.
> 이 문서는 `lifecycle: draft` 계획 문서이며, 구현/테스트가 끝난 항목만 해당 spec으로 흡수한다.

## 목적 ^purpose

완료된 spec 작업을 다시 소유하지 않고, 아직 구현/검증 전인 잔여 작업만 추적한다. `.todo.md`가 남아 있는 동안 현재 동작의 SSOT는 각 `.spec.md`와 source/test 경로다.

---

## 완료 현황 (각 spec에 반영됨)

| 스펙 | 상태 | 테스트 |
|------|:---:|------|
| gate-engine.spec.md | 완료 | 38파일/911 tests |
| bigint-addressing.spec.md | 완료 | B-1~B-3 전부 완료 (32 tests) |
| coordinate-query.spec.md | 완료 | 39파일/922 tests, named-policy 11 tests |
| decode-service.spec.md | 완료 | D-1~D-5 완료 (39 tests) |
| gate-service.spec.md | 완료 | E-1~E-4 완료 (47 tests) |
| query-service.spec.md | 완료 | F-1~F-5 완료 (29 tests) |
| 횡단 인프라 (H) | 완료 | TaskQueue+BullMQ+Worker+DLQ, SQL 어댑터 3종 |
| 하드웨어 가속 (G) | G-1~G-6 완료 | wi-hardware-acceleration.spec.md에 반영 |
| 데이터 파이프라인 (I) | I-1~I-4,I-6 완료 | Cache 11, Aggregation 10, MV 13, Redis 16, AxisProjection 12 |

최종 게이트: 5 build / demo-tests 654 tests / index-meta 922 tests / ingest-server 141 tests / gate-service 14 tests / query-service 29 tests — 전부 통과

### 분리 단위 판단 (해소됨)

- coordinate-query: 4개 leaf spec 분할 완료 (policy/cross-index/version/relational, 각 120~192줄)
- query-service: 5개 leaf spec 분할 완료 (rules/api/gate-integration/migration/state-replay, 각 104~169줄)

---

## 잔여 작업

### G-3. FPGA 인터페이스 설계

- [ ] FPGAAdapter 인터페이스 + threshold 기반 CPU/FPGA 분기
- 우선순위: 낮, 난이도: 높

### I. 데이터 파이프라인 잔여

| # | 작업 | 우선순위 | 난이도 | 설명 |
|---|---|---|---|---|
| I-5 | Streaming consumer PoC | 낮 | 높 | Kafka/SSE consumer → batch encode → store 파이프라인 |
