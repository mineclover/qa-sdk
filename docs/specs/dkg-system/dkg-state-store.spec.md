---
def:
  id: dkg-state-store
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [observability, persistence, data]
  links:
    - target: dkg-node-types
      type: depends_on
    - target: dkg-edge-types
      type: depends_on
    - target: dkg-skill-catalog
      type: depends_on
---
# DKG State Store


## 탐색 ^navigation

dkg-system > **dkg-state-store**

형제: `dkg-node-types` · `dkg-edge-types` · `dkg-queries` · `dkg-constraint` · `dkg-growth-spiral` · `dkg-skills-system` · `dkg-service-topology`

## 목적 ^purpose

DKG 그래프의 로컬 영속 저장소. `~/.qa-sdk/state.sqlite`에 노드/엣지/사용량/메타데이터를 보관한다. bootstrapDkg()로 초기화된 그래프가 세션 간 유지되고, 수동 기록(Decision/Observation/Claim)이 보존된다.

## 테이블 (5개)

소스: `packages/spec-core/src/db/schema.ts`

### dkg_nodes — DKG 노드

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | text PK | 노드 ID (예: `page_view`, `DEC-CAPACITY-xxx`) |
| kind | text | 16종 노드 유형 (axis, prefix, decision, observation, skill 등) |
| source | text | `bootstrap` (카탈로그 파생), `manual` (사용자 기록), `auto` (skill 자동 생성) |
| catalog_id | text | 소속 카탈로그 (기본 `demo`) |
| data | text (JSON) | 전체 노드 데이터 (kind별 구조 상이) |
| created_at | text | 생성 시각 |
| updated_at | text | 갱신 시각 |

- `source` 구분이 핵심: `dkg refresh` 시 `bootstrap` 노드는 재생성, `manual`/`auto` 노드는 보존
- 인덱스: kind, source, catalog_id

### dkg_edges — DKG 엣지

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | integer PK | 자동 증가 |
| type | text | 18종 엣지 유형 (composes, references, governs, observes 등) |
| from_id | text | 출발 노드 |
| to_id | text | 도착 노드 |
| source | text | bootstrap / manual / auto |
| catalog_id | text | 소속 카탈로그 |
| meta | text (JSON, nullable) | 엣지 메타데이터 |
| created_at | text | 생성 시각 |

- 유니크 제약: (type, from_id, to_id)
- 인덱스: (from_id, type), (to_id, type), catalog_id

### usage_snapshots — 사용량 스냅샷

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | integer PK | 자동 증가 |
| collected_at | text | 수집 시각 |
| period_from | text | 집계 시작 |
| period_to | text | 집계 종료 |
| total_records | integer | 레코드 수 |
| data | text (JSON) | 전체 UsageData (entryUsages, addressUsages, coOccurrences, versionUsages) |

- `dkg converge --persist` 또는 self-check에서 기록

### version_usages — 버전별 사용 이력

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | integer PK | 자동 증가 |
| snapshot_id | integer FK | usage_snapshots.id |
| prefix | text | prefix ID |
| version | text | 버전 (v1, v2 등) |
| count | integer | 관측 횟수 |
| last_seen | text | 마지막 관측 시각 |
| sessions | text (JSON) | 세션 ID 목록 |

- 배포 스큐 추적: 같은 prefix의 서로 다른 version이 동시 관측되면 스큐
- 인덱스: (prefix, version), snapshot_id

### dkg_meta — 키-값 메타데이터

| 컬럼 | 타입 | 설명 |
|------|------|------|
| key | text PK | 메타 키 |
| value | text | 메타 값 |

예약 키:
- `last_decision` — 마지막 Decision ID
- `claim:<nodeId>` — 노드별 작업 선점 데이터 (JSON: `{ by, at, reason }`)
- `last_bootstrap` — 마지막 bootstrap 시각

## 생명주기

```
dkg refresh → bootstrap 노드/엣지 전체 재생성 + manual/auto 보존
dkg decide/observe/claim → manual 노드/엣지 추가
dkg converge --persist → usage_snapshots + version_usages 기록
dkg run skill-* → auto 노드/엣지 생성 가능
```
