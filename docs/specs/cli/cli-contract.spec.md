---
def:
  id: cli-contract-spec
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: approved
  tags: [entry-point]
  links:
    - target: dsl-schemas-spec
      type: depends_on
    - target: address-context-spec
      type: depends_on
---
# QA-SDK CLI 계약

## 목적 ^purpose

APM 스키마 관리, 좌표 연산, DKG 진단, 의사결정 흐름을 CLI로 제공하는 관측 도구.
CLI는 시스템을 제어하지 않는다 — 외부 상태를 스캔하고, DSL에 등록하고, 변경을 시뮬레이션하고, 인터페이스를 생성한다.

## 구성 ^overview

16개 커맨드 그룹, 80+ 서브커맨드:
scan/register/dry-run/codegen (스키마 파이프라인),
encode/decode/resolve/list-prefixes/list-axes (좌표 DX),
spec list/resolve/validate/trace (스펙 조작),
dkg 20+ (DKG 진단/분석),
flow 12+ (의사결정 흐름),
service/ingest/gate/query (서비스 토폴로지),
sync-obsidian (볼트 동기화).

## 커맨드 그룹

### 스키마 파이프라인

| 커맨드 | 역할 |
|--------|------|
| `scan git` | Git 메타데이터 → SchemaSnapshot |
| `register` | SchemaSnapshot → Registry 등록 |
| `dry-run` | 변경 시뮬레이션 (DAG 전파, 실제 변경 없음) |
| `codegen` | SchemaSnapshot → 타입 인터페이스 생성 |

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
