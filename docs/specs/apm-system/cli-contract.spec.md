---
def:
  tier: component
  id: cli-contract-spec
  address: def_document:v2:413824
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: cli
  tags: [entry-point]
  links:
    - target: apm-schema-system
      type: depends_on
    - target: address-context-format
      type: depends_on
    - target: git-utils
      type: depends_on
  sources:
    - packages/cli/src/index.ts
    - packages/cli/src/command-groups/root.commands.ts
    - packages/cli/src/commands/codegen.ts
    - packages/cli/src/commands/flow.ts
    - packages/cli/src/commands/quality.ts
    - packages/cli/src/commands/ingest.ts
    - packages/cli/src/commands/codegen.test.ts
    - packages/cli/src/scenarios.e2e.test.ts
---
# QA-SDK CLI 계약

## 목적 ^purpose

APM 스키마 관리, 좌표 연산, DKG 진단, 의사결정 흐름을 CLI로 제공하는 관측 도구.
CLI는 시스템을 제어하지 않는다 — 외부 상태를 스캔하고, DSL에 등록하고, 변경을 시뮬레이션하고, 인터페이스를 생성한다.

## 구성 ^overview

17개 커맨드 그룹, 85+ 서브커맨드:
scan/register/dry-run/codegen (스키마 파이프라인),
encode/decode/resolve/list-prefixes/list-axes (좌표 DX),
spec list/resolve/validate/trace (스펙 조작),
dkg 20+ (DKG 진단/분석),
flow 12+ (의사결정 흐름),
quality 9 (상태 요약/export/조회/실행/추천/claim 감사),
service/ingest/gate/query (서비스 토폴로지),
sync-obsidian (볼트 동기화).

## 커맨드 그룹

### 스키마 파이프라인

| 커맨드 | 역할 |
|--------|------|
| `scan git` | Git 메타데이터 → SchemaSnapshot |
| `register` | SchemaSnapshot → Registry 등록 |
| `dry-run` | 변경 시뮬레이션 — `--catalog` 또는 `--registry` 기반 (DAG 전파, 실제 변경 없음) |
| `codegen` | Catalog/Registry → 타입 인터페이스 생성 (`--catalog` 또는 `--registry` 필수) |

### 좌표 DX

| 커맨드 | 역할 |
|--------|------|
| `encode` | 차원 값 → 1D 정수 |
| `decode` | 1D 정수 → 차원 값 |
| `resolve` | 시맨틱 주소 해석 |
| `list-prefixes` | 카탈로그 prefix 목록 |
| `list-axes` | 카탈로그 축 목록 |
| `find-version` | prefix 버전 조회 |
| `derive-refs` | prefix_ref 파생 |
| `impact` | 변경 영향 분석 |

### DKG 진단

`dkg` 하위 20+ 서브커맨드: axes, prefixes, domains, flow-schemas, impacts, overlaps, history, skew, coverage, skills, services 등.

### 의사결정 흐름

| 커맨드 | 역할 |
|--------|------|
| `flow list` | FlowSchema 목록 |
| `flow start <schema-id>` | 흐름 시작 |
| `flow select <branch-id>` | 분기 선택 |
| `flow status` | 현재 상태 |
| `flow trace <instance-id>` | 코어 결정 추적 |
| `flow analyze <schema-id>` | 구조 분석 |
| `flow policy learn/list/compare` | 정책 학습/비교 |

### 품질 게이트

| 커맨드 | 역할 |
|--------|------|
| `quality list` | gate 문서 목록과 필터 조회 |
| `quality status [bundle-id]` | quality bundle 상태 요약과 verified 비율 조회 |
| `quality export [bundle-id] --output=<path>` | quality bundle 상태 스냅샷을 JSON artifact로 저장 |
| `quality bundle <bundle-id>` | level/scope 기준 번들 문서 조회 |
| `quality claims <bundle-id>` | contract marker 기반 claim 감사표 출력 |
| `quality show <gate-id>` | gate 문서 상세 + 추천 흐름 조회 |
| `quality run <gate-id>` | gate 명령 실행 + quality-ledger 기록 (`--json` 시 구조화 결과 출력) |
| `quality next <gate-id>` | 성공/실패 기준 다음 gate/doc 추천 |
| `quality diagnose <gate-id>` | 최근 실행 결과와 RCA 기반 진단 조회 |

### 서비스 토폴로지

| 커맨드 | 역할 |
|--------|------|
| `service list/show/health/owners/endpoints` | 서비스 조회 |
| `ingest health/send/status` | 수집 서버 점검 |
| `gate check/state/recompute` | 게이트 조회 |
| `query rules/range/filter` | 질의 서비스 |

## 설계 원칙

CLI는 **관측 도구**다. 시스템을 제어하지 않는다.
- scan: 외부 상태 읽기
- register: DSL에 등록
- dry-run: 시뮬레이션
- codegen: 인터페이스 생성
- 실제 버전 범프, 빌드, 배포는 환경 도구가 담당

## 검증 ^validation

```bash
corepack pnpm --filter @qa-sdk/cli test codegen
corepack pnpm --filter @qa-sdk/cli test flow
corepack pnpm --filter @qa-sdk/cli test quality
corepack pnpm --filter @qa-sdk/cli test ingest-mode
```
