---
def:
  id: quality-gates-system
  tier: system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, entry-point, cross-scope, quality-bundle]
  links:
    - target: gate-kind-taxonomy
      type: contains
    - target: gate-tracker-spec
      type: contains
    - target: harness-model-spec
      type: contains
    - target: harness-state-model
      type: contains
    - target: work-domain-quality-bundle
      type: depends_on
    - target: definition-quality-gates
      type: depends_on
    - target: decision-flow-quality-bundle
      type: depends_on
    - target: ingest-quality-bundle
      type: depends_on
    - target: query-quality-bundle
      type: depends_on
    - target: definition-service-quality-bundle
      type: depends_on
    - target: decode-quality-bundle
      type: depends_on
    - target: registry-quality-bundle
      type: depends_on
    - target: quality-ledger
      type: contains
    - target: dkg-harness-bridge
      type: contains
---
# Quality Gates System

## 목적 ^purpose

실행 가능한 품질 게이트 문서를 개념 번들 단위로 묶고, 하네스를 유한 상태 모델(`concept-defined → contract-bound → gate-bound → verified`)로 읽게 하는 루트 그룹. `verified`는 문서 존재가 아니라 gate 실행 원장(`quality-ledger`)으로 판정한다.

## 구성 ^overview

8개 품질 번들 + 인프라 2개로 구성된다.

- 8개 번들: work-domain, definition, decision-flow, ingest, query, decode, registry, definition-service
- `quality-ledger`: gate 실행 결과 영속 원장 (SQLite). verified 판정의 데이터 소스
- `dkg-harness-bridge`: DKG analysis skill ↔ 하네스 품질 게이트 연결 명세

## 현재 검증 현황

| bundle | claims | gates | 상태 |
|---|---:|---:|---|
| `work-domain-quality-bundle` | 15 | 3 | verified |
| `decision-flow-quality-bundle` | 15 | 3 | verified |
| `ingest-quality-bundle` | 15 | 3 | verified |
| `query-quality-bundle` | 15 | 3 | verified |
| `decode-quality-bundle` | 15 | 3 | verified |
| `registry-quality-bundle` | 15 | 3 | verified |
| `definition-service-quality-bundle` | 15 | 3 | verified |
| `definition-quality-gates` | 18 | 3 | verified |

루트 시스템 상태:

- `quality bundle quality-gates-system` → `verified`
- `quality status quality-gates-system` → bundle별 claim/gate verified 비율 요약
- gate 문서 수: `24`
- `quality claims quality-gates-system` → `verified 18`
- `quality export quality-gates-system --output=artifacts/quality-gates-system.json` → 현재 상태 스냅샷 JSON 생성

## 운영 라이프사이클

루트 품질 시스템을 다시 검증할 때 권장하는 순서는 다음과 같다.

1. `qa-sdk def sync`
2. `qa-sdk def validate`
3. `qa-sdk quality show gate-definition-quality-cli`
4. `qa-sdk quality run gate-definition-quality-cli --json`
5. `qa-sdk quality diagnose gate-definition-quality-cli --json`
6. `qa-sdk quality next gate-definition-quality-cli --outcome=pass --json`
7. `qa-sdk quality claims definition-quality-gates`
8. `qa-sdk quality bundle quality-gates-system`
9. `qa-sdk quality status quality-gates-system --json`
10. `qa-sdk quality export quality-gates-system --output=artifacts/quality-gates-system.json`

이 순서는 문서 그래프 동기화 → 구조 검증 → 대표 gate 실행 → 진단/후속 gate 판단 → claim 감사 → bundle/system 요약 → snapshot export를 한 번에 닫는다.

## 최근 실행

2026-03-30 기준 최근 실행 결과:

- commit: `26c3bcfd9dc4856f94ea44ec719a96b9d9ebf189`
- `gate-definition-quality-cli` 재실행 결과: `pass`, `durationMs=12146`
- `definition-quality-gates` claim audit: `18/18 verified`
- `quality-gates-system` bundle 상태: `verified`, `24/24 gate verified`
- root status snapshot generatedAt: `2026-03-30T00:32:17.716Z`
- export artifact: `artifacts/quality-gates-system.json`
