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
sources:
  - packages/work-domain/src/harness.ts
  - packages/work-domain/src/harness-model.ts
  - packages/work-domain/src/gate-tracker.ts
  - packages/quality-ledger/src/ledger.ts
  - packages/cli/src/commands/quality.ts
  - package.json
  - scripts/check-format.mjs
  - scripts/validate-skills.mjs
  - scripts/ai-feedback-loop.ts
  - scripts/verify-analysis-os.ts
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

### Workspace 안정화 baseline

위 quality-ledger snapshot과 별개로, workspace 전체 안정화 검증은 2026-07-15의 `2315514a`에서 다음 기준을 통과했다. 이 표는 실행 결과의 요약이며, `quality-ledger`의 bundle 상태를 자동으로 갱신하는 기록은 아니다.

| 검증 | 결과 |
|---|---|
| `corepack pnpm test` | workspace scope 132개 중 131개 통과. 외부 DB/PG 의존 시나리오는 환경 조건에 따라 skip |
| `corepack pnpm format:check` | 추적 source 4,692개 통과 |
| `corepack pnpm lint:ci` | 2,904개 파일, warning/error 0 |
| `corepack pnpm arch:feedback` | 71/71 통과 |
| `corepack pnpm def:check` | approved 1,000, purpose 누락 0, short 0, orphan 0. `svc` 누락 142건은 informational |
| `corepack pnpm skills:check` | 36 skills, 45 files 통과 |
| workspace build | 오류 없이 완료. package export 조건, CJS `import.meta`, Vite chunk/dynamic import 관련 기존 warning만 존재 |
| representative Playwright E2E | `scenario-selector.spec.ts`의 `viz-web loads and shows scenario selector` 1건 통과 |

`packages/e2e`의 기본 `test`는 CI 중복 실행을 막기 위한 noop이며, 브라우저 검증은 전용 `test:e2e` 및 대표 시나리오로 분리한다. 따라서 전체 test 결과의 skip/noop과 실제 실패를 같은 상태로 세지 않는다.

### Definition DB 전체 동기화 검증

이전 기록의 `545 errors / 30 warnings`는 기존 baseline으로 분리할 수 있는 결과가 아니었다. 전체 동기화에서 탈락한 문서 39건, 문서 `sources`를 boundary로 잘못 추론한 validator 경로, 실제 그래프 링크/경계 누락을 함께 포함하고 있었다. taxonomy 좌표 보정, 그래프 링크 정리, `doc_frontmatter`와 `@def.boundary` 분리, `rlsc` 시스템 anchor 추가 후 다음 명령이 통과한다.

```bash
node packages/cli/dist/index.js def sync
node packages/cli/dist/index.js def validate
node packages/cli/dist/index.js def audit
```

현재 기준으로 `def sync`는 `1,461건 문서 / 3,949건 링크`를 적재하며, `def validate: 0 errors / 0 warnings`, `def audit` 그래프 검증도 `0 errors / 0 warnings`다. 따라서 해당 수치를 “기존 definition graph baseline”이라고 남기지 않고 해결된 회귀 원인과 검증 절차를 이 문서가 관리한다.
