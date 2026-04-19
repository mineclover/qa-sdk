---
def:
  id: pipe-store-sqlite
  level: leaf
  scope: data
  aspect: system_data
  depth: implementation
  lifecycle: approved
  layer: operation
  svc: pipe-store-sqlite
  links:
    - target: pipe-store
      type: depends_on
sources:
  - packages/pipe-store-sqlite/src/store.ts
  - packages/pipe-store-sqlite/src/manifest-store.ts
  - packages/pipe-store-sqlite/src/store.test.ts
  - packages/pipe-store-sqlite/src/manifest-store.test.ts
---

# PipeGraph / PipeSpec / ManifestRegistry SQLite 저장소

## 목적 ^purpose

PipeGraphStore, PipeSpecStore, ManifestRegistry의 SQLite 영속 어댑터.
장기 보관 및 CLI 워크플로우용. 인메모리 어댑터를 drop-in 교체.

## 정의 ^defines

- `SqlitePipeGraphStore` — PipeGraphStore SQLite 구현
- `SqlitePipeSpecStore` — PipeSpecStore SQLite 구현
- `SqliteManifestRegistry` — ManifestRegistry SQLite 구현
- 4개 테이블: `pipe_graphs`, `pipe_specs`, `prefix_versions`, `service_manifests`

## 관련 소스

- `packages/pipe-store-sqlite/src/store.ts` — PipeGraph/PipeSpec 저장소
- `packages/pipe-store-sqlite/src/manifest-store.ts` — ManifestRegistry
- `packages/pipe-store-sqlite/src/db/schema.ts` — Drizzle 스키마

## 스키마 설계

| 테이블 | PK | JSON 필드 |
|---|---|---|
| `pipe_graphs` | `graphId:version` | `pipes[]`, `connections[]` |
| `pipe_specs` | `pipeId:version` | `trigger`, `flow`, `produces[]` |
| `prefix_versions` | `prefixId:version` | — |
| `service_manifests` | `serviceId:manifestVersion` | `prefixes{}` |

- **PipeFlow 30종**: `flow` 컬럼에 JSON 직렬화. 라운드트립 보장
- **버전 정렬**: `getLatest` — 사전순 최대값
- **listAll**: 각 ID의 최신 버전만 (`GROUP BY` + `MAX`)

## 드라이버

```typescript
// drizzle-orm/node-sqlite + index-meta
const db = getDatabaseSync();
migrate(drizzle({ client: db }), { migrationsFolder: "../drizzle" });
```

PRAGMA: `journal_mode = WAL`, `busy_timeout = 3000`

## ManifestRegistry 상태 전이

```
Prefix:   draft → released → active → deprecated → archived
Manifest: draft → published → active → superseded → archived
```

- `published` 전이 조건: 모든 prefix가 released 이상
- `active` 전이 시 참조 prefix를 자동으로 `active`로 승격
- 새 manifest `active` 시 이전 manifest는 `superseded`

## 검증

```bash
pnpm --filter pipe-store-sqlite test
# store.test.ts: 14 tests (SqlitePipeGraphStore 10 + SqlitePipeSpecStore 4)
# manifest-store.test.ts: 16 tests (lifecycle 11 + 조회 3 + 영속 2)
```
