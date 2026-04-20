---
def:
  id: dkg-state-store-observability
  level: leaf
  tier: component
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [observability, persistence, runtime]
  links:
    - target: dkg-state-store
      type: refines
    - target: definition-mgmt-observability-model
      type: depends_on
---
# DKG State Store — Observability Facet

## 목적 ^purpose

DKG 로컬 상태 저장소에서 관측성과 감사 추적을 담당하는 facet을 정의한다. usage snapshot은 coarse telemetry를, CLI audit event는 EventRecord 기반 감사 로그를 담당한다.

## 구성 ^overview

### usage_snapshots

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | integer PK | 자동 증가 |
| collected_at | text | 수집 시각 |
| period_from | text | 집계 시작 |
| period_to | text | 집계 종료 |
| total_records | integer | 레코드 수 |
| data | text(JSON) | 전체 UsageData |

### version_usages

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | integer PK | 자동 증가 |
| snapshot_id | integer FK | usage snapshot 참조 |
| prefix | text | prefix ID |
| version | text | version ID |
| count | integer | 관측 횟수 |
| last_seen | text | 마지막 관측 시각 |
| sessions | text(JSON) | 세션 목록 |

### cli_audit_events

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | integer PK | 자동 증가 |
| catalog_id | text | 카탈로그 구분 |
| event_prefix | text | `cli_event` / `spec_event` / `dkg_event` 등 |
| command | text | CLI 명령 |
| event_key | text | `cli.command.executed`, `cli.spec.lifecycle`, `cli.dkg.version` |
| target_id | text | 대상 식별자 |
| target_kind | text | `spec`, `version` 등 |
| lifecycle_from | text | 전이 전 상태 |
| lifecycle_to | text | 전이 후 상태 |
| timestamp | text | EventRecord timestamp |
| address_context | text(JSON) | serialized prefix address map |
| payload | text(JSON) | 감사 payload |
| record_json | text(JSON) | 전체 EventRecord |

## 운영 규칙

- `saveUsageSnapshot`
  coverage, skew, dormant analysis용 coarse telemetry를 남긴다.
- `saveCliAuditEvent`
  CLI lifecycle/event audit trail을 남긴다.
- `QA_CLI_AUDIT_INGEST_URL` 또는 `INGEST_URL`이 있으면
  audit record를 `/v1/ingest`로 best-effort forwarding한다.
- 로컬 audit log와 중앙 ingest는 중복이 아니라 역할이 다르다.
  로컬 SQLite는 즉시 조회용, ingest는 전역 trace/analytics용이다.

## 조회 표면

- `qa-sdk dkg history`
  usage snapshot + version usage 요약
- `qa-sdk dkg audit-events`
  CLI audit log 조회

## 관련 소스

- `packages/dkg/src/store/dkg-sqlite-store.ts`
- `packages/cli/src/commands/dkg.ts`
