---
def:
  id: dkg-state-store-graph
  level: leaf
  tier: component
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [persistence, structural]
  links:
    - target: dkg-state-store
      type: refines
    - target: dkg-node-types
      type: depends_on
    - target: dkg-edge-types
      type: depends_on
---
# DKG State Store — Graph Facet

## 목적 ^purpose

DKG 노드/엣지와 메타 키를 로컬 SQLite에 저장하는 graph facet을 정의한다. bootstrap graph 재생성, manual/auto 변경 보존, catalog 단위 분리를 이 facet이 맡는다.

## 구성 ^overview

### dkg_nodes

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | text PK | 노드 ID |
| kind | text | DKG node kind |
| source | text | `bootstrap` / `manual` / `auto` |
| catalog_id | text | 카탈로그 구분 |
| data | text(JSON) | 노드 전체 payload |
| created_at | text | 생성 시각 |
| updated_at | text | 수정 시각 |

### dkg_edges

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | integer PK | 자동 증가 |
| type | text | DKG edge type |
| from_id | text | 출발 노드 |
| to_id | text | 도착 노드 |
| source | text | `bootstrap` / `manual` / `auto` |
| catalog_id | text | 카탈로그 구분 |
| meta | text(JSON) | 엣지 메타데이터 |
| created_at | text | 생성 시각 |

### dkg_meta

| 컬럼 | 타입 | 설명 |
|------|------|------|
| key | text PK | 메타 키 |
| value | text | 메타 값 |

## 운영 규칙

- `dkg refresh`
  bootstrap 노드/엣지를 재생성하되 `manual`/`auto`는 보존한다.
- `dkg decide/observe/claim`
  manual source로 추가한다.
- `dkg run skill-*`, `dkg converge --persist`
  auto source 노드/엣지를 추가할 수 있다.

## 관련 소스

- `packages/dkg/src/store/dkg-sqlite-store.ts`
- `packages/dkg/src/db/schema.ts`
